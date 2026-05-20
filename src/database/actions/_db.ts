import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { Client, Transaction } from '@libsql/client'
import { createClient } from '@libsql/client'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import { ensureSearchIndex } from '@/database/actions/search-index'
import initialSchemaSql from '@/database/migrations/001_initial_schema.sql?raw'
import * as schema from '@/database/schema'
import type { SqliteExecutor } from '@/database/support/libsql'
import { isSqliteTestRuntime } from '@/database/support/test-runtime'
import type { Project } from '@/models/project'

type Database = ReturnType<typeof drizzle>
type ProjectDatabase = ReturnType<typeof drizzle<typeof schema>>
type LibsqlValue = Uint8Array | boolean | number | string | null
type DatabaseEntry = {
    client: SqliteExecutor
    db: Database
    initialized?: Promise<void>
}
type ProjectDatabaseEntry = {
    client: Client
    db: ProjectDatabase
}

type Migration = {
    id: string
    sql: string
}

export type SqliteConnection = {
    client: Client | Transaction
    close(): Promise<void>
    db: ProjectDatabase
}

const migrations: Migration[] = [
    {
        id: '001_initial_schema',
        sql: initialSchemaSql,
    },
]

const databases = new Map<string, DatabaseEntry>()
const testDatabases = new Map<string, ProjectDatabaseEntry>()
const actionDatabaseBinding = new AsyncLocalStorage<DatabaseEntry>()

const syncedTables = [
    'sources',
    'chunks',
    'observations',
    'diary_entries',
    'retrieval_documents',
    'target_embeddings',
    'modules',
    'memory_fts',
    'memory_fts_indexed',
    'retrieval_documents_fts',
] as const

function currentDatabase(): Database {
    const bound = actionDatabaseBinding.getStore()
    if (bound) {
        return bound.db
    }

    return currentDatabaseEntry().db
}

function currentDatabaseEntry(): DatabaseEntry {
    const databaseUrl = isSqliteTestRuntime()
        ? ':memory:'
        : `file:${resolveDatabasePathFromCwd()}`
    const existing = databases.get(databaseUrl)
    if (existing) {
        return existing
    }

    const client = createClient({ url: databaseUrl })
    const entry = {
        client,
        db: drizzle(client),
    }
    databases.set(databaseUrl, entry)
    return entry
}

export function projectDatabasePath(context: Project): string {
    return join(context.memoryDir, 'memory.sqlite')
}

export async function openProjectDatabase(
    context: Project,
): Promise<SqliteConnection> {
    await ensureConfigFile(context)
    const { client, db, ownsClient } = openDatabaseClient(context)
    const connection = createConnection(client, db, ownsClient)
    await runMigrations(connection)
    await ensureSearchIndex(connection)

    return connection
}

export async function ensureProjectDatabase(context: Project): Promise<void> {
    const connection = await openProjectDatabase(context)
    await connection.close()
}

export async function withTransaction<T>(
    connection: SqliteConnection,
    operation: (tx: SqliteConnection) => Promise<T>,
): Promise<T> {
    if (isSqliteTestRuntime() || !('transaction' in connection.client)) {
        return withActionDatabase(connection.client, connection.db, () =>
            operation(connection),
        )
    }

    const transaction = await connection.client.transaction('write')
    const txDb = drizzle(transaction as unknown as Client, { schema })
    const txConnection = createConnection(transaction, txDb, false)

    try {
        const result = await withActionDatabase(transaction, txDb, () =>
            operation(txConnection),
        )
        await transaction.commit()
        return result
    } catch (error) {
        await transaction.rollback()
        throw error
    }
}

function openDatabaseClient(context: Project): ProjectDatabaseEntry & {
    ownsClient: boolean
} {
    if (isSqliteTestRuntime()) {
        const key = projectDatabasePath(context)
        const existing = testDatabases.get(key)
        if (existing) {
            return { ...existing, ownsClient: false }
        }

        const client = createClient({ url: ':memory:' })
        const db = drizzle(client, { schema })
        const entry = { client, db }
        testDatabases.set(key, entry)
        return { ...entry, ownsClient: false }
    }

    const databasePath = projectDatabasePath(context)
    const client = createClient({ url: `file:${databasePath}` })
    return { client, db: drizzle(client, { schema }), ownsClient: true }
}

function createConnection(
    client: Client | Transaction,
    db: ProjectDatabase,
    ownsClient: boolean,
): SqliteConnection {
    return {
        client,
        async close() {
            if (ownsClient && 'close' in client) {
                client.close()
            }
        },
        db,
    }
}

async function runMigrations(connection: SqliteConnection): Promise<void> {
    await withTransaction(connection, async tx => {
        await tx.db.run(sql`
create table if not exists schema_migrations (
    id text primary key,
    applied_at text not null
);
`)

        const applied = new Set(
            (
                await tx.db.all<{ id: string }>(
                    sql`select id from schema_migrations`,
                )
            ).map(row => row.id),
        )

        for (const migration of migrations) {
            if (applied.has(migration.id)) {
                continue
            }

            await tx.client.executeMultiple(migration.sql)
            await tx.db.run(
                sql`insert into schema_migrations (id, applied_at) values (${migration.id}, ${new Date().toISOString()})`,
            )
        }
    })
}

async function syncTestActionDatabase(
    sourceClient: SqliteExecutor,
): Promise<void> {
    if (!isSqliteTestRuntime()) {
        throw new Error('syncTestActionDatabase can only run in tests.')
    }

    const { client: targetClient } = currentDatabaseEntry()
    await targetClient.executeMultiple(initialSchemaSql)
    await clearSyncedTables(targetClient)
    const targetDb = drizzle(targetClient as Client)

    const sourceDb = drizzle(sourceClient as Client)
    for (const table of syncedTables) {
        const rows = await sourceDb.all<Record<string, unknown>>(
            sql.raw(`select * from ${table}`),
        )
        await insertRows(targetDb, table, rows)
    }
}

async function ensureActionDatabase(): Promise<void> {
    if (actionDatabaseBinding.getStore()) {
        return
    }

    const entry = currentDatabaseEntry()
    entry.initialized ??= entry.client.executeMultiple(initialSchemaSql)
    await entry.initialized
}

async function clearSyncedTables(client: SqliteExecutor): Promise<void> {
    for (const table of [...syncedTables].reverse()) {
        await client.execute(`delete from ${table}`)
    }
}

async function insertRows(
    database: Database,
    table: string,
    rows: Record<string, unknown>[],
): Promise<void> {
    for (const row of rows) {
        const columns = Object.keys(row)
        if (columns.length === 0) {
            continue
        }

        const columnList = columns.map(column => `"${column}"`).join(', ')
        await database.run(
            sql`insert into ${sql.raw(table)} (${sql.raw(columnList)}) values (${sql.join(
                columns.map(column => sql`${row[column] as LibsqlValue}`),
                sql`, `,
            )})`,
        )
    }
}

async function withActionDatabase<T>(
    client: SqliteExecutor,
    db: Database,
    operation: () => Promise<T>,
): Promise<T> {
    return actionDatabaseBinding.run({ client, db }, operation)
}

async function ensureConfigFile(context: Project): Promise<void> {
    if (context.configExists) {
        return
    }

    await mkdir(context.memoryDir, { recursive: true })
    await writeFile(
        context.configPath,
        `${JSON.stringify(context.config, null, 2)}\n`,
        { flag: 'wx' },
    ).catch(error => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error
        }
    })
}

function resolveDatabasePathFromCwd(): string {
    const projectRoot = findProjectRoot(process.cwd())
    return join(projectRoot, '.konteks', 'memory.sqlite')
}

function findProjectRoot(start: string): string {
    let current = resolve(start)

    while (true) {
        if (
            existsSync(join(current, '.git')) ||
            existsSync(join(current, 'package.json'))
        ) {
            return current
        }

        const parent = dirname(current)
        if (parent === current) {
            return resolve(start)
        }
        current = parent
    }
}

const db = new Proxy(
    {
        ensureActionDatabase,
        syncTestActionDatabase,
        withActionDatabase,
    } as Database & {
        ensureActionDatabase(): Promise<void>
        syncTestActionDatabase(client: SqliteExecutor): Promise<void>
        withActionDatabase<T>(
            client: SqliteExecutor,
            db: Database,
            operation: () => Promise<T>,
        ): Promise<T>
    },
    {
        get(target, property, receiver) {
            if (property in target) {
                return Reflect.get(target, property, receiver)
            }

            return Reflect.get(currentDatabase(), property, receiver)
        },
    },
)

export default db

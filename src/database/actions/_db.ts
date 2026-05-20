import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import {
    querySql,
    type SqliteExecutor,
} from '@/providers/persistence/sqlite/libsql-helpers'
import initialSchemaSql from '@/providers/persistence/sqlite/migrations/001_initial_schema.sql?raw'
import { isSqliteTestRuntime } from '@/providers/persistence/sqlite/test-runtime'

type Database = ReturnType<typeof drizzle>
type LibsqlValue = Uint8Array | boolean | number | string | null
type DatabaseEntry = {
    client: SqliteExecutor
    db: Database
    initialized?: Promise<void>
}

const databases = new Map<string, DatabaseEntry>()
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

function currentClient(): SqliteExecutor {
    const bound = actionDatabaseBinding.getStore()
    if (bound) {
        return bound.client
    }

    return currentDatabaseEntry().client
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

async function syncTestActionDatabase(
    sourceClient: SqliteExecutor,
): Promise<void> {
    if (!isSqliteTestRuntime()) {
        throw new Error('syncTestActionDatabase can only run in tests.')
    }

    const { client: targetClient } = currentDatabaseEntry()
    await targetClient.executeMultiple(initialSchemaSql)
    await clearSyncedTables(targetClient)

    for (const table of syncedTables) {
        const rows = await querySql<Record<string, unknown>>(
            sourceClient,
            `select * from ${table}`,
        )
        await insertRows(targetClient, table, rows)
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
    client: SqliteExecutor,
    table: string,
    rows: Record<string, unknown>[],
): Promise<void> {
    for (const row of rows) {
        const columns = Object.keys(row)
        if (columns.length === 0) {
            continue
        }

        const placeholders = columns.map(() => '?').join(', ')
        const columnList = columns.map(column => `"${column}"`).join(', ')
        await client.execute({
            args: columns.map(column => row[column] as LibsqlValue),
            sql: `insert into ${table} (${columnList}) values (${placeholders})`,
        })
    }
}

async function withActionDatabase<T>(
    client: SqliteExecutor,
    db: Database,
    operation: () => Promise<T>,
): Promise<T> {
    return actionDatabaseBinding.run({ client, db }, operation)
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
        currentClient,
        ensureActionDatabase,
        syncTestActionDatabase,
        withActionDatabase,
    } as Database & {
        currentClient(): SqliteExecutor
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

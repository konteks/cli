import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Client, Transaction } from '@libsql/client'
import { createClient } from '@libsql/client'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/libsql'
import ensureSearchIndex from '@/database/actions/ensure-search-index'
import initialSchemaSql from '@/database/migrations/001_initial_schema.sql?raw'
import * as schema from '@/database/schema'
import { isSqliteTestRuntime } from '@/database/support/test-runtime'
import type { Project } from '@/models/project'
import { loadProjectContext } from '@/providers/project/context'

type ProjectDatabase = ReturnType<typeof drizzle<typeof schema>>
type DatabaseEntry = {
    connection: SqliteConnection
    initialized?: Promise<void>
}

type Migration = {
    id: string
    sql: string
}

type SqliteConnection = {
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
const currentConnection = new AsyncLocalStorage<SqliteConnection>()

async function currentDatabaseEntry(): Promise<DatabaseEntry> {
    if (isSqliteTestRuntime()) {
        return databaseEntry(':memory:', false)
    }

    const context = await loadProjectContext()
    const databaseUrl = `file:${projectDatabasePath(context)}`
    const existing = databases.get(databaseUrl)
    if (existing) {
        return existing
    }

    await ensureConfigFile(context)
    return databaseEntry(databaseUrl, true)
}

function databaseEntry(
    databaseUrl: string,
    ownsClient: boolean,
): DatabaseEntry {
    const existing = databases.get(databaseUrl)
    if (existing) {
        return existing
    }
    const client = createClient({ url: databaseUrl })
    const connection = createConnection(
        client,
        drizzle(client as Client, { schema }),
        ownsClient,
    )
    const entry = {
        connection,
        initialized: initializeDatabase(connection),
    }
    databases.set(databaseUrl, entry)
    return entry
}

export function projectDatabasePath(context: Project): string {
    return join(context.memoryDir, 'memory.sqlite')
}

export async function withTransaction<T>(
    operation: () => Promise<T>,
): Promise<T> {
    const activeConnection = currentConnection.getStore()
    if (activeConnection) {
        return operation()
    }

    const entry = await currentDatabaseEntry()
    await entry.initialized
    const { connection } = entry

    if (isSqliteTestRuntime() || !('transaction' in connection.client)) {
        return runWithConnection(connection, operation)
    }

    const transaction = await connection.client.transaction('write')
    const txDb = drizzle(transaction as unknown as Client, { schema })
    const txConnection = createConnection(transaction, txDb, false)

    try {
        const result = await runWithConnection(txConnection, () => operation())
        await transaction.commit()
        return result
    } catch (error) {
        await transaction.rollback()
        throw error
    }
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
    await runWithConnection(connection, async () => {
        await connection.db.run(sql`
create table if not exists schema_migrations (
    id text primary key,
    applied_at text not null
);
`)

        const applied = new Set(
            (
                await connection.db.all<{ id: string }>(
                    sql`select id from schema_migrations`,
                )
            ).map(row => row.id),
        )

        for (const migration of migrations) {
            if (applied.has(migration.id)) {
                continue
            }

            await connection.client.executeMultiple(migration.sql)
            await connection.db.run(
                sql`insert into schema_migrations (id, applied_at) values (${migration.id}, ${new Date().toISOString()})`,
            )
        }
    })
}

async function initializeDatabase(connection: SqliteConnection): Promise<void> {
    await runMigrations(connection)
    await runWithConnection(connection, () => ensureSearchIndex())
}

async function runWithConnection<T>(
    connection: SqliteConnection,
    operation: () => Promise<T>,
): Promise<T> {
    return currentConnection.run(connection, operation)
}

export default async function getDb(): Promise<ProjectDatabase> {
    const bound = currentConnection.getStore()
    if (bound) {
        return bound.db
    }

    const entry = await currentDatabaseEntry()
    await entry.initialized
    return entry.connection.db
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

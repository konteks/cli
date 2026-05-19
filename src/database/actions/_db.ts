import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { type Client, createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import {
    querySql,
    type SqliteExecutor,
} from '@/providers/persistence/sqlite/libsql-helpers'
import initialSchemaSql from '@/providers/persistence/sqlite/migrations/001_initial_schema.sql?raw'

type Database = ReturnType<typeof drizzle>
type LibsqlValue = Uint8Array | boolean | number | string | null
type DatabaseEntry = {
    client: Client
    db: Database
}

const databases = new Map<string, DatabaseEntry>()

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
    return currentDatabaseEntry().db
}

function currentDatabaseEntry(): DatabaseEntry {
    const databaseUrl = isTestRuntime()
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

function isTestRuntime(): boolean {
    return (
        process.env.NODE_ENV === 'test' &&
        process.argv.some(argument => argument.includes('.test.'))
    )
}

async function syncTestActionDatabase(
    sourceClient: SqliteExecutor,
): Promise<void> {
    if (!isTestRuntime()) {
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

async function clearSyncedTables(client: Client): Promise<void> {
    for (const table of [...syncedTables].reverse()) {
        await client.execute(`delete from ${table}`)
    }
}

async function insertRows(
    client: Client,
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
    { syncTestActionDatabase } as Database & {
        syncTestActionDatabase(client: SqliteExecutor): Promise<void>
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

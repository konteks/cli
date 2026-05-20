import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Client, Transaction } from '@libsql/client'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import actionDb from '@/database/actions/_db'
import type { Project } from '@/models/project'
import runMigrations from './run-migrations'
import * as schema from './schema'
import { ensureSearchIndex } from './search-index'
import { isSqliteTestRuntime } from './test-runtime'

type KonteksDb = ReturnType<typeof drizzle<typeof schema>>

export type SqliteConnection = {
    client: Client | Transaction
    close(): Promise<void>
    db: KonteksDb
}

type ProjectDatabaseEntry = {
    client: Client
    db: KonteksDb
}

const testDatabases = new Map<string, ProjectDatabaseEntry>()

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

export async function ensureProjectDatabase(context: Project): Promise<void> {
    const connection = await openProjectDatabase(context)
    await connection.close()
}

export async function withTransaction<T>(
    connection: SqliteConnection,
    operation: (tx: SqliteConnection) => Promise<T>,
): Promise<T> {
    if (isSqliteTestRuntime() || !('transaction' in connection.client)) {
        return actionDb.withActionDatabase(
            connection.client,
            connection.db,
            () => operation(connection),
        )
    }

    const transaction = await connection.client.transaction('write')
    const txDb = drizzle(transaction as unknown as Client, { schema })
    const txConnection = createConnection(transaction, txDb, false)

    try {
        const result = await actionDb.withActionDatabase(
            transaction,
            txDb,
            () => operation(txConnection),
        )
        await transaction.commit()
        return result
    } catch (error) {
        await transaction.rollback()
        throw error
    }
}

function createConnection(
    client: Client | Transaction,
    db: KonteksDb,
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

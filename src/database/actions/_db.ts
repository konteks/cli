import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Client } from '@libsql/client'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import ensureSearchIndex from '@/database/actions/ensure-search-index'
import * as schema from '@/database/schema'
import { isSqliteTestRuntime } from '@/database/support/test-runtime'
import runMigrations from '@/database/utils/migrations'
import type { Project } from '@/models/project'
import { loadProjectContext } from '@/providers/project/context'

type ProjectDatabase = ReturnType<typeof drizzle<typeof schema>>
type DatabaseEntry = {
    client: Client
    db: ProjectDatabase
    initialized: Promise<void>
}

const databases = new Map<string, DatabaseEntry>()
const currentDatabase = new AsyncLocalStorage<ProjectDatabase>()

async function currentDatabaseEntry(): Promise<DatabaseEntry> {
    if (isSqliteTestRuntime()) {
        return databaseEntry(':memory:')
    }

    const context = await loadProjectContext()
    const databaseUrl = `file:${projectDatabasePath(context)}`
    const existing = databases.get(databaseUrl)
    if (existing) {
        return existing
    }

    await ensureConfigFile(context)
    return databaseEntry(databaseUrl)
}

function databaseEntry(databaseUrl: string): DatabaseEntry {
    const existing = databases.get(databaseUrl)
    if (existing) {
        return existing
    }
    const client = createClient({ url: databaseUrl })
    const db = drizzle(client, { schema })
    const entry = {
        client,
        db,
        initialized: initializeDatabase(client, db),
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
    const activeDatabase = currentDatabase.getStore()
    if (activeDatabase) {
        return operation()
    }

    const entry = await currentDatabaseEntry()
    await entry.initialized

    if (isSqliteTestRuntime() || !('transaction' in entry.client)) {
        return currentDatabase.run(entry.db, operation)
    }

    const transaction = await entry.client.transaction('write')
    const txDb = drizzle(transaction as unknown as Client, { schema })

    try {
        const result = await currentDatabase.run(txDb, operation)
        await transaction.commit()
        return result
    } catch (error) {
        await transaction.rollback()
        throw error
    }
}

async function initializeDatabase(
    client: Client,
    db: ProjectDatabase,
): Promise<void> {
    await runMigrations(client, db)
    await currentDatabase.run(db, () => ensureSearchIndex())
}

export default async function getDb(): Promise<ProjectDatabase> {
    const bound = currentDatabase.getStore()
    if (bound) {
        return bound
    }

    const entry = await currentDatabaseEntry()
    await entry.initialized
    return entry.db
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

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import type { Project } from '@/models/project'
import DatabaseService from './database-service'
import runMigrations from './run-migrations'
import * as schema from './schema'
import { ensureSearchIndex } from './search-index'

export function projectDatabasePath(context: Project): string {
    return join(context.memoryDir, 'memory.sqlite')
}

export async function openProjectDatabase(
    context: Project,
): Promise<DatabaseService> {
    await ensureConfigFile(context)
    const databasePath = projectDatabasePath(context)
    const client = createClient({ url: `file:${databasePath}` })
    const db = drizzle(client, { schema })
    const service = new DatabaseService(client, db)
    await runMigrations(service)
    await ensureSearchIndex(service)

    return service
}

export async function ensureProjectDatabase(context: Project): Promise<void> {
    const service = await openProjectDatabase(context)
    await service.close()
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

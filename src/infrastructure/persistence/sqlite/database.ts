import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import type { Project } from '@/domain/entities/project.js'
import { DatabaseService } from './db.js'
import { runMigrations } from './migrations.js'
import * as schema from './schema.js'
import { ensureSearchIndex } from './search-index.js'
import { openWasmSqliteAdapter } from './wasm-sqlite-adapter.js'

export function projectDatabasePath(context: Project): string {
    return join(context.memoryDir, 'memory.sqlite')
}

export async function openProjectDatabase(
    context: Project,
): Promise<DatabaseService> {
    await ensureConfigFile(context)
    const adapter = await openWasmSqliteAdapter(projectDatabasePath(context))
    await runMigrations(adapter)
    await ensureSearchIndex(adapter)

    const db = drizzle(
        async (sql, params, method) => {
            if (method === 'run') {
                await adapter.execute(sql, params)
                return { rows: [] }
            }

            const rows = await adapter.queryArrays(sql, params)
            if (method === 'get') {
                return { rows: rows[0] ?? [] }
            }
            return { rows }
        },
        { schema },
    )

    return new DatabaseService(adapter, db)
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

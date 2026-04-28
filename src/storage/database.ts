import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LoadedProjectContext } from '../project/context.js'
import { runMigrations } from './migrations.js'
import { openWasmSqliteAdapter } from './wasm-sqlite-adapter.js'

export function projectDatabasePath(context: LoadedProjectContext): string {
    return join(context.memoryDir, 'memory.sqlite')
}

export async function openProjectDatabase(
    context: LoadedProjectContext,
): Promise<Awaited<ReturnType<typeof openWasmSqliteAdapter>>> {
    await ensureConfigFile(context)
    const adapter = await openWasmSqliteAdapter(projectDatabasePath(context))
    await runMigrations(adapter)
    return adapter
}

export async function ensureProjectDatabase(
    context: LoadedProjectContext,
): Promise<void> {
    const adapter = await openProjectDatabase(context)
    await adapter.close()
}

async function ensureConfigFile(context: LoadedProjectContext): Promise<void> {
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

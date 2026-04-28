import { join } from 'node:path'
import type { LoadedProjectContext } from '../project/context.js'
import { runMigrations } from './migrations.js'
import { openWasmSqliteAdapter } from './wasm-sqlite-adapter.js'

export function projectDatabasePath(context: LoadedProjectContext): string {
    return join(context.memoryDir, 'memory.sqlite')
}

async function openProjectDatabase(
    context: LoadedProjectContext,
): Promise<Awaited<ReturnType<typeof openWasmSqliteAdapter>>> {
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

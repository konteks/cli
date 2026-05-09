import { join } from 'node:path'
import type { SaveProjectUpdate } from '../memory/save-store.js'
import { readMineManifest } from '../mining/manifest.js'
import { mineProject } from '../mining/mine-project.js'
import { loadProjectContext, pathExists } from '../project/context.js'
import {
    openProjectDatabase,
    projectDatabasePath,
} from '../storage/database.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import type { ProjectContext, StartMcpServerOptions } from '../types/mcp.js'

export async function withProjectDatabase<T>(
    options: StartMcpServerOptions,
    operation: (adapter: SqliteAdapter, context: ProjectContext) => Promise<T>,
): Promise<T> {
    const context = await loadMcpProjectContext(options)
    return withProjectDatabaseContext(context, adapter =>
        operation(adapter, context),
    )
}

export async function loadMcpProjectContext(
    options: StartMcpServerOptions,
): Promise<ProjectContext> {
    const context = await loadProjectContext(options.project)
    if (!options.memoryDir) {
        return context
    }

    const configPath = join(options.memoryDir, 'config.json')
    return {
        ...context,
        configExists: await pathExists(configPath),
        configPath,
        memoryDir: options.memoryDir,
    }
}

export async function withProjectDatabaseContext<T>(
    context: ProjectContext,
    operation: (adapter: SqliteAdapter) => Promise<T>,
): Promise<T> {
    const adapter = await openProjectDatabase(context)

    try {
        return await operation(adapter)
    } finally {
        await adapter.close()
    }
}

export async function validateMcpProjectHealth(
    context: ProjectContext,
): Promise<void> {
    if (!context.configExists) {
        throw new Error(
            'Konteks memory is not initialized. Run `konteks init`.',
        )
    }
    if (!(await readMineManifest(context.memoryDir))) {
        throw new Error(
            'Konteks memory is missing extraction artifacts. Run `konteks repair`.',
        )
    }
    if (!(await pathExists(projectDatabasePath(context)))) {
        throw new Error(
            'Konteks memory database is missing. Run `konteks repair`.',
        )
    }
}

export async function updateChangedProjectMemorySilently(
    context: ProjectContext,
): Promise<SaveProjectUpdate | undefined> {
    if (!context.configExists || !(await readMineManifest(context.memoryDir))) {
        return undefined
    }

    const result = await mineProject(context, 'changed')
    return {
        deletedFilePaths: result.deletedFilePaths,
        updatedFilePaths: result.updatedFilePaths,
    }
}

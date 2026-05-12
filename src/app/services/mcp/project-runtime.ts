import { join } from 'node:path'
import {
    openProjectDatabase,
    projectDatabasePath,
} from '@/app/database/sqlite/database'
import type { DatabaseService } from '@/app/database/sqlite/db'
import type { SaveProjectUpdate } from '@/app/database/sqlite/save-store'
import {
    loadProjectContext,
    pathExists,
} from '@/app/services/file-system/context'
import type {
    ProjectContext,
    StartMcpServerOptions,
} from '@/app/services/mcp/types'
import { readMineManifest } from '@/app/services/mining/engine/manifest'
import { mineProject } from '@/app/services/mining/mine-project'

export async function withProjectDatabase<T>(
    options: StartMcpServerOptions,
    operation: (
        service: DatabaseService,
        context: ProjectContext,
    ) => Promise<T>,
): Promise<T> {
    const context = await loadMcpProjectContext(options)
    return withProjectDatabaseContext(context, service =>
        operation(service, context),
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
    operation: (service: DatabaseService) => Promise<T>,
): Promise<T> {
    const service = await openProjectDatabase(context)

    try {
        return await operation(service)
    } finally {
        await service.close()
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

import { join } from 'node:path'
import type { SaveOptions } from '@/app/contracts/repositories/memory-repository'
import { readMineManifest } from '@/app/providers/extraction/engine/manifest'
import { mineProject } from '@/app/providers/extraction/mine-project'
import { openProjectDatabase } from '@/app/providers/persistence/sqlite/database'
import type { DatabaseService } from '@/app/providers/persistence/sqlite/db'
import { loadProjectContext, pathExists } from '@/app/providers/project/context'
import type {
    ProjectContext,
    StartMcpServerOptions,
} from '@/app/providers/protocol/types'

type SaveProjectUpdate = NonNullable<SaveOptions['projectUpdate']>

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

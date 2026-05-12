import { join } from 'node:path'
import type { SaveOptions } from '@/contracts/repositories/memory-repository'
import type { McpProjectContext, StartMcpServerOptions } from '@/models/mcp'
import { readMineManifest } from '@/providers/extraction/engine/manifest'
import { mineProject } from '@/providers/extraction/mine-project'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import type { DatabaseService } from '@/providers/persistence/sqlite/db'
import { loadProjectContext, pathExists } from '@/providers/project/context'

type SaveProjectUpdate = NonNullable<SaveOptions['projectUpdate']>

export async function withProjectDatabase<T>(
    options: StartMcpServerOptions,
    operation: (
        service: DatabaseService,
        context: McpProjectContext,
    ) => Promise<T>,
): Promise<T> {
    const context = await loadMcpProjectContext(options)
    return withProjectDatabaseContext(context, service =>
        operation(service, context),
    )
}

export async function loadMcpProjectContext(
    options: StartMcpServerOptions,
): Promise<McpProjectContext> {
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
    context: McpProjectContext,
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
    context: McpProjectContext,
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

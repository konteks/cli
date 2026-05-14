import { join } from 'node:path'
import type { SaveOptions } from '@/contracts/repositories/memory-repository'
import type { McpProjectContext, StartMcpServerOptions } from '@/models/mcp'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { extractProject } from '@/providers/extraction/extract-project'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import type { DatabaseService } from '@/providers/persistence/sqlite/db'
import { loadProjectContext, pathExists } from '@/providers/project/context'

type SaveProjectUpdate = NonNullable<SaveOptions['projectUpdate']>

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
    options: StartMcpServerOptions = {},
): Promise<SaveProjectUpdate | undefined> {
    if (
        !context.configExists ||
        !(await readExtractionManifest(context.memoryDir))
    ) {
        return undefined
    }

    const result = await extractProject(context, 'changed', {
        treeSitterEngine: options.treeSitterEngine,
    })
    return {
        deletedFilePaths: result.deletedFilePaths,
        updatedFilePaths: result.updatedFilePaths,
    }
}

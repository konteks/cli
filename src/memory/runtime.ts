import type { SaveOptions } from '@/contracts/repositories/memory-repository'
import type { LoadedProjectContext } from '@/models/project'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { extractProject } from '@/providers/extraction/extract-project'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import type DatabaseService from '@/providers/persistence/sqlite/database-service'
import { loadProjectContext } from '@/providers/project/context'

type SaveProjectUpdate = NonNullable<SaveOptions['projectUpdate']>
export type McpProjectContext = LoadedProjectContext

export async function loadMcpProjectContext(): Promise<McpProjectContext> {
    return await loadProjectContext()
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
    if (
        !context.configExists ||
        !(await readExtractionManifest(context.memoryDir))
    ) {
        return undefined
    }

    const result = await extractProject(context, 'changed')
    return {
        deletedFilePaths: result.deletedFilePaths,
        updatedFilePaths: result.updatedFilePaths,
    }
}

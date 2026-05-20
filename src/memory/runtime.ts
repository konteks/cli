import type { SaveOptions } from '@/contracts/repositories/memory-repository'
import type { SqliteConnection } from '@/database/actions/_db'
import { openProjectDatabase } from '@/database/actions/_db'
import type { LoadedProjectContext } from '@/models/project'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { extractProject } from '@/providers/extraction/extract-project'
import { loadProjectContext } from '@/providers/project/context'

type SaveProjectUpdate = NonNullable<SaveOptions['projectUpdate']>
export type McpProjectContext = LoadedProjectContext

export async function loadMcpProjectContext(): Promise<McpProjectContext> {
    return await loadProjectContext()
}

export async function withProjectDatabaseContext<T>(
    context: McpProjectContext,
    operation: (service: SqliteConnection) => Promise<T>,
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

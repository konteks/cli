import type { SaveOptions } from '@/database/services/save-memory'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { extractProject } from '@/providers/extraction/extract-project'
import { loadProjectContext } from '@/providers/project/context'
import type { LoadedProjectContext } from '@/types/project'

type SaveProjectUpdate = NonNullable<SaveOptions['projectUpdate']>
export type McpProjectContext = LoadedProjectContext

export async function loadMcpProjectContext(): Promise<McpProjectContext> {
    return await loadProjectContext()
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

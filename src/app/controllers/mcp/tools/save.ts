import { SaveMemoryAction } from '@/app/actions/save-memory-action'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabaseContext,
} from '@/app/composition/mcp-project-runtime'
import { createMemoryRepository } from '@/app/composition/memory-repository'
import type { SaveInput } from '@/app/providers/protocol/inputs'
import { formatSaveText } from '@/app/providers/protocol/retrieval-format'
import type { StartMcpServerOptions } from '@/app/providers/protocol/types'
import { formatToTextResult } from './result'

export async function handleSaveTool(
    options: StartMcpServerOptions,
    input: SaveInput,
) {
    const context = await loadMcpProjectContext(options)
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    const saved = await withProjectDatabaseContext(context, service => {
        const repo = createMemoryRepository(service, context)
        const action = new SaveMemoryAction(repo)
        return action.execute(input, { projectUpdate })
    })
    return formatToTextResult(formatSaveText(saved))
}

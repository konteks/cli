import { SaveMemoryAction } from '@/app/actions/save-memory-action'
import { SQLiteMemoryRepository } from '@/app/providers/database/sqlite/sqlite-memory-repository'
import type { SaveInput } from '@/app/providers/mcp/inputs'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabaseContext,
} from '@/app/providers/mcp/project-runtime'
import { formatSaveText } from '@/app/providers/mcp/retrieval-format'
import type { StartMcpServerOptions } from '@/app/providers/mcp/types'
import { formatToTextResult } from './result'

export async function handleSaveTool(
    options: StartMcpServerOptions,
    input: SaveInput,
) {
    const context = await loadMcpProjectContext(options)
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    const saved = await withProjectDatabaseContext(context, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const action = new SaveMemoryAction(repo)
        return action.execute(input, { projectUpdate })
    })
    return formatToTextResult(formatSaveText(saved))
}

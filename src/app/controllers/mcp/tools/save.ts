import { SaveMemoryAction } from '@/app/actions/save-memory-action'
import { SQLiteMemoryRepository } from '@/app/providers/persistence/sqlite/sqlite-memory-repository'
import type { SaveInput } from '@/app/providers/protocol/inputs'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabaseContext,
} from '@/app/providers/protocol/project-runtime'
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
        const repo = new SQLiteMemoryRepository(service, context)
        const action = new SaveMemoryAction(repo)
        return action.execute(input, { projectUpdate })
    })
    return formatToTextResult(formatSaveText(saved))
}

import { RecallMemoryAction } from '@/app/actions/recall-memory-action'
import { SQLiteMemoryRepository } from '@/app/database/sqlite/sqlite-memory-repository'
import type { RecallInput } from '@/app/services/mcp/inputs'
import {
    loadMcpProjectContext,
    validateMcpProjectHealth,
    withProjectDatabase,
} from '@/app/services/mcp/project-runtime'
import { formatRecallText } from '@/app/services/mcp/retrieval-format'
import type { StartMcpServerOptions } from '@/app/services/mcp/types'
import { formatToTextResult } from './result'

export async function handleRecallTool(
    options: StartMcpServerOptions,
    input: RecallInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const recall = await withProjectDatabase(options, async service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const action = new RecallMemoryAction(repo)
        return action.execute(input)
    })

    return formatToTextResult(
        formatRecallText({
            includeSources: input.includeSources ?? false,
            recall,
        }),
    )
}

import { RecallMemoryAction } from '@/app/actions/recall-memory-action'
import { SQLiteMemoryRepository } from '@/app/providers/persistence/sqlite/sqlite-memory-repository'
import type { RecallInput } from '@/app/providers/protocol/inputs'
import {
    loadMcpProjectContext,
    withProjectDatabase,
} from '@/app/providers/protocol/project-runtime'
import { formatRecallText } from '@/app/providers/protocol/retrieval-format'
import type { StartMcpServerOptions } from '@/app/providers/protocol/types'
import { formatToTextResult } from './result'

export async function handleRecallTool(
    options: StartMcpServerOptions,
    input: RecallInput,
) {
    const context = await loadMcpProjectContext(options)
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

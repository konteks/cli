import { RecallMemoryAction } from '@/app/actions/recall-memory-action'
import {
    loadMcpProjectContext,
    withProjectDatabase,
} from '@/app/composition/mcp-project-runtime'
import { createMemoryRepository } from '@/app/composition/memory-repository'
import type { RecallInput } from '@/app/providers/protocol/inputs'
import { formatRecallText } from '@/app/providers/protocol/retrieval-format'
import type { StartMcpServerOptions } from '@/app/providers/protocol/types'
import { formatToTextResult } from './result'

export async function handleRecallTool(
    options: StartMcpServerOptions,
    input: RecallInput,
) {
    const context = await loadMcpProjectContext(options)
    const recall = await withProjectDatabase(options, async service => {
        const repo = createMemoryRepository(service, context)
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

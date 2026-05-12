import { WarmUpAction } from '@/app/actions/warm-up-action'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabase,
} from '@/app/composition/mcp-project-runtime'
import { createMemoryRepository } from '@/app/composition/memory-repository'
import type { WarmUpInput } from '@/app/providers/protocol/inputs'
import { formatWarmUpText } from '@/app/providers/protocol/retrieval-format'
import type { StartMcpServerOptions } from '@/app/providers/protocol/types'
import { formatToTextResult } from './result'

export async function handleWarmUpTool(
    options: StartMcpServerOptions,
    input: WarmUpInput,
) {
    const context = await loadMcpProjectContext(options)
    await updateChangedProjectMemorySilently(context)

    const result = await withProjectDatabase(options, service => {
        const repo = createMemoryRepository(service, context)
        const action = new WarmUpAction(context, repo)
        return action.execute(input)
    })

    return formatToTextResult(formatWarmUpText(result))
}

import { WarmUpAction } from '@/app/actions/warm-up-action'
import { SQLiteMemoryRepository } from '@/app/providers/database/sqlite/sqlite-memory-repository'
import type { WarmUpInput } from '@/app/providers/mcp/inputs'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    withProjectDatabase,
} from '@/app/providers/mcp/project-runtime'
import { formatWarmUpText } from '@/app/providers/mcp/retrieval-format'
import type { StartMcpServerOptions } from '@/app/providers/mcp/types'
import { formatToTextResult } from './result'

export async function handleWarmUpTool(
    options: StartMcpServerOptions,
    input: WarmUpInput,
) {
    const context = await loadMcpProjectContext(options)
    await updateChangedProjectMemorySilently(context)

    const result = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const action = new WarmUpAction(context, repo)
        return action.execute(input)
    })

    return formatToTextResult(formatWarmUpText(result))
}

import { WarmUpAction } from '@/app/actions/warm-up-action'
import { SQLiteMemoryRepository } from '@/app/database/sqlite/sqlite-memory-repository'
import type { WarmUpInput } from '@/app/mcp/inputs'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    validateMcpProjectHealth,
    withProjectDatabase,
} from '@/app/mcp/project-runtime'
import { formatWarmUpText } from '@/app/mcp/retrieval-format'
import type { StartMcpServerOptions } from '@/app/mcp/types'
import { formatToTextResult } from './result'

export async function handleWarmUpTool(
    options: StartMcpServerOptions,
    input: WarmUpInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    await updateChangedProjectMemorySilently(context)

    const result = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const action = new WarmUpAction(context, repo)
        return action.execute(input)
    })

    return formatToTextResult(formatWarmUpText(result))
}

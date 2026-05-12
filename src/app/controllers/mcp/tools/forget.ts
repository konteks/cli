import { ForgetMemoryAction } from '@/app/actions/forget-memory-action'
import { SQLiteMemoryRepository } from '@/app/database/sqlite/sqlite-memory-repository'
import type { ForgetInput } from '@/app/services/mcp/inputs'
import {
    loadMcpProjectContext,
    validateMcpProjectHealth,
    withProjectDatabase,
} from '@/app/services/mcp/project-runtime'
import type { StartMcpServerOptions } from '@/app/services/mcp/types'
import { formatToTextResult } from './result'

export async function handleForgetTool(
    options: StartMcpServerOptions,
    input: ForgetInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const result = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const action = new ForgetMemoryAction(repo)
        return action.execute(input)
    })
    return formatToTextResult(result)
}

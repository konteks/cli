import { ForgetMemoryAction } from '@/app/actions/forget-memory-action'
import { SQLiteMemoryRepository } from '@/app/providers/database/sqlite/sqlite-memory-repository'
import type { ForgetInput } from '@/app/providers/mcp/inputs'
import {
    loadMcpProjectContext,
    withProjectDatabase,
} from '@/app/providers/mcp/project-runtime'
import type { StartMcpServerOptions } from '@/app/providers/mcp/types'
import { formatToTextResult } from './result'

export async function handleForgetTool(
    options: StartMcpServerOptions,
    input: ForgetInput,
) {
    const context = await loadMcpProjectContext(options)
    const result = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const action = new ForgetMemoryAction(repo)
        return action.execute(input)
    })
    return formatToTextResult(result)
}

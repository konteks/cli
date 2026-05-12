import { ForgetMemoryAction } from '@/app/actions/forget-memory-action'
import {
    loadMcpProjectContext,
    withProjectDatabase,
} from '@/app/composition/mcp-project-runtime'
import { createMemoryRepository } from '@/app/composition/memory-repository'
import type { ForgetInput } from '@/app/providers/protocol/inputs'
import type { StartMcpServerOptions } from '@/app/providers/protocol/types'
import { formatToTextResult } from './result'

export async function handleForgetTool(
    options: StartMcpServerOptions,
    input: ForgetInput,
) {
    const context = await loadMcpProjectContext(options)
    const result = await withProjectDatabase(options, service => {
        const repo = createMemoryRepository(service, context)
        const action = new ForgetMemoryAction(repo)
        return action.execute(input)
    })
    return formatToTextResult(result)
}

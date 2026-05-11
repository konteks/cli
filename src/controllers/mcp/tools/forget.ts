import { ForgetMemoryUseCase } from '@/application/use-cases/forget-memory-use-case'
import { SQLiteMemoryRepository } from '@/infrastructure/persistence/sqlite/sqlite-memory-repository'
import type { ForgetInput } from '@/interfaces/mcp/inputs'
import {
    loadMcpProjectContext,
    validateMcpProjectHealth,
    withProjectDatabase,
} from '@/interfaces/mcp/project-runtime'
import type { StartMcpServerOptions } from '@/interfaces/mcp/types'
import { formatToTextResult } from './result'

export async function handleForgetTool(
    options: StartMcpServerOptions,
    input: ForgetInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const result = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const useCase = new ForgetMemoryUseCase(repo)
        return useCase.execute(input)
    })
    return formatToTextResult(result)
}

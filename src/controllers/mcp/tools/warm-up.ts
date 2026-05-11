import { WarmUpUseCase } from '@/application/use-cases/warm-up-use-case'
import { SQLiteMemoryRepository } from '@/infrastructure/persistence/sqlite/sqlite-memory-repository'
import type { WarmUpInput } from '@/interfaces/mcp/inputs'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    validateMcpProjectHealth,
    withProjectDatabase,
} from '@/interfaces/mcp/project-runtime'
import { formatWarmUpText } from '@/interfaces/mcp/retrieval-format'
import type { StartMcpServerOptions } from '@/interfaces/mcp/types'
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
        const useCase = new WarmUpUseCase(context, repo)
        return useCase.execute(input)
    })

    return formatToTextResult(formatWarmUpText(result))
}

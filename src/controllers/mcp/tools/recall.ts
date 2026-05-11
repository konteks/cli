import { RecallMemoryUseCase } from '@/application/use-cases/recall-memory-use-case'
import { SQLiteMemoryRepository } from '@/infrastructure/persistence/sqlite/sqlite-memory-repository'
import type { RecallInput } from '@/interfaces/mcp/inputs'
import {
    loadMcpProjectContext,
    validateMcpProjectHealth,
    withProjectDatabase,
} from '@/interfaces/mcp/project-runtime'
import { formatRecallText } from '@/interfaces/mcp/retrieval-format'
import type { StartMcpServerOptions } from '@/interfaces/mcp/types'
import { formatToTextResult } from './result'

export async function handleRecallTool(
    options: StartMcpServerOptions,
    input: RecallInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const recall = await withProjectDatabase(options, async service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const useCase = new RecallMemoryUseCase(repo)
        return useCase.execute(input)
    })

    return formatToTextResult(
        formatRecallText({
            includeSources: input.includeSources ?? false,
            recall,
        }),
    )
}

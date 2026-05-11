import { SearchMemoryUseCase } from '@/application/use-cases/search-memory-use-case'
import { SQLiteMemoryRepository } from '@/infrastructure/persistence/sqlite/sqlite-memory-repository'
import type { SearchInput } from '@/interfaces/mcp/inputs'
import {
    loadMcpProjectContext,
    validateMcpProjectHealth,
    withProjectDatabase,
} from '@/interfaces/mcp/project-runtime'
import { formatSearchText } from '@/interfaces/mcp/retrieval-format'
import type { StartMcpServerOptions } from '@/interfaces/mcp/types'
import { formatToTextResult } from './result'

export async function handleSearchTool(
    options: StartMcpServerOptions,
    input: SearchInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const results = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const useCase = new SearchMemoryUseCase(repo)
        return useCase.execute(input)
    })
    return formatToTextResult(
        formatSearchText({
            limit: input.limit ?? 10,
            query: input.query,
            results,
        }),
    )
}

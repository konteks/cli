import { SearchMemoryAction } from '@/app/actions/search-memory-action'
import { SQLiteMemoryRepository } from '@/app/database/sqlite/sqlite-memory-repository'
import type { SearchInput } from '@/app/mcp/inputs'
import {
    loadMcpProjectContext,
    validateMcpProjectHealth,
    withProjectDatabase,
} from '@/app/mcp/project-runtime'
import { formatSearchText } from '@/app/mcp/retrieval-format'
import type { StartMcpServerOptions } from '@/app/mcp/types'
import { formatToTextResult } from './result'

export async function handleSearchTool(
    options: StartMcpServerOptions,
    input: SearchInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const results = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const action = new SearchMemoryAction(repo)
        return action.execute(input)
    })
    return formatToTextResult(
        formatSearchText({
            limit: input.limit ?? 10,
            query: input.query,
            results,
        }),
    )
}

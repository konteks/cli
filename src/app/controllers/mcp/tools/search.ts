import { SearchMemoryAction } from '@/app/actions/search-memory-action'
import {
    loadMcpProjectContext,
    withProjectDatabase,
} from '@/app/composition/mcp-project-runtime'
import { createMemoryRepository } from '@/app/composition/memory-repository'
import type { SearchInput } from '@/app/providers/protocol/inputs'
import { formatSearchText } from '@/app/providers/protocol/retrieval-format'
import type { StartMcpServerOptions } from '@/app/providers/protocol/types'
import { formatToTextResult } from './result'

export async function handleSearchTool(
    options: StartMcpServerOptions,
    input: SearchInput,
) {
    const context = await loadMcpProjectContext(options)
    const results = await withProjectDatabase(options, service => {
        const repo = createMemoryRepository(service, context)
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

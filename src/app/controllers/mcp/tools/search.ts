import { SearchMemoryAction } from '@/app/actions/search-memory-action'
import { SQLiteMemoryRepository } from '@/app/providers/persistence/sqlite/sqlite-memory-repository'
import type { SearchInput } from '@/app/providers/protocol/inputs'
import {
    loadMcpProjectContext,
    withProjectDatabase,
} from '@/app/providers/protocol/project-runtime'
import { formatSearchText } from '@/app/providers/protocol/retrieval-format'
import type { StartMcpServerOptions } from '@/app/providers/protocol/types'
import { formatToTextResult } from './result'

export async function handleSearchTool(
    options: StartMcpServerOptions,
    input: SearchInput,
) {
    const context = await loadMcpProjectContext(options)
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

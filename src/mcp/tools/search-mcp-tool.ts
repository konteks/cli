import z from 'zod'
import formatMemory from '@/mcp/tools/utils/format-memory'
import inline from '@/mcp/tools/utils/inline'
import searchMemory from '@/memory/search-memory'
import type { StartMcpServerOptions } from '@/models/mcp'
import type { MemorySearchResult } from '@/models/memory'
import BaseMcpTool from './_base-mcp-tool'

const INPUT_SCHEMA = z.object({
    limit: z.number().int().min(1).max(50).optional(),
    query: z.string().min(1, 'query is required'),
})

export default class SearchMcpTool extends BaseMcpTool {
    annotations = {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
    }

    description =
        'Search stored memory directly and return matching records with IDs, sources, scores, and excerpts.'

    inputSchema = INPUT_SCHEMA

    name = 'konteks_search'

    protected async coreHandle(
        options: StartMcpServerOptions,
        input: z.output<typeof INPUT_SCHEMA>,
    ) {
        return formatSearchText({
            limit: input.limit ?? 10,
            query: input.query,
            results: await searchMemory(options, input),
        })
    }
}

function formatSearchText(input: {
    query: string
    limit: number
    results: MemorySearchResult[]
}): string {
    return [
        'search:',
        `  query: ${inline(input.query)}`,
        `  limit: ${input.limit}`,
        '  results:',
        ...input.results
            .slice(0, input.limit)
            .map(item => formatMemory(item, 4)),
    ].join('\n')
}

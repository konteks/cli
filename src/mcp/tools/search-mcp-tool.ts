import z from 'zod'
import { openProjectDatabase } from '@/database/actions/_db'
import searchMemory from '@/database/services/search-memory'
import formatMemory from '@/mcp/tools/utils/format-memory'
import inline from '@/mcp/tools/utils/inline'
import { loadMcpProjectContext } from '@/memory/runtime'
import type { MemorySearchResult } from '@/models/memory'
import BaseMcpTool from './_base-mcp-tool'

const INPUT_SCHEMA = z.object({
    limit: z.number().int().min(1).max(50).optional(),
    query: z.string().min(1, 'query is required'),
})

type Input = z.output<typeof INPUT_SCHEMA>

export default class SearchMcpTool extends BaseMcpTool<Input> {
    public readonly annotations = {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
    }

    public readonly description =
        'Search stored memory directly and return matching records with IDs, sources, scores, and excerpts.'

    public readonly inputSchema = INPUT_SCHEMA

    public readonly name = 'konteks_search'

    public async handle(input: Input): Promise<string> {
        const context = await loadMcpProjectContext()
        const db = await openProjectDatabase(context)
        try {
            const results = await searchMemory(db, input)

            return formatSearchText({
                limit: input.limit ?? 10,
                query: input.query,
                results,
            })
        } finally {
            await db.close()
        }
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

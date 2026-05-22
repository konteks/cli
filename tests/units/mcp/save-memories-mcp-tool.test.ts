import { describe, expect, it } from 'bun:test'
import type z from 'zod'
import SaveMemoriesMcpTool from '@/entrypoints/mcp/tools/save-memories-mcp-tool'

describe('SaveMemoriesMcpTool input schema', () => {
    it('accepts a durable memory batch', () => {
        expect(
            parse(new SaveMemoriesMcpTool(), {
                memories: [
                    {
                        content: 'Use class based MCP tools.',
                        importance: 3,
                        kind: 'decision',
                    },
                ],
            }),
        ).toEqual({
            memories: [
                {
                    content: 'Use class based MCP tools.',
                    importance: 3,
                    kind: 'decision',
                },
            ],
        })
    })
})

function parse(tool: { inputSchema: z.ZodObject }, input: unknown) {
    return tool.inputSchema.parse(input)
}

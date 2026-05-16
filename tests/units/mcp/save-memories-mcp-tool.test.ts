import { describe, expect, it } from 'bun:test'
import z from 'zod'
import type { McpInputSchema } from '@/mcp/tools/_base-mcp-tool'
import SaveMemoriesMcpTool from '@/mcp/tools/save-memories-mcp-tool'

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

function parse(tool: { inputSchema: McpInputSchema }, input: unknown) {
    return z
        .object(tool.inputSchema as Record<string, z.ZodTypeAny>)
        .parse(input)
}

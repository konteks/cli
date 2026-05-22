import { describe, expect, it } from 'bun:test'
import z from 'zod'
import type { McpInputSchema } from '@/entrypoints/mcp/tools/_base-mcp-tool'
import SaveDiaryMcpTool from '@/entrypoints/mcp/tools/save-diary-mcp-tool'

describe('SaveDiaryMcpTool input schema', () => {
    it('accepts a diary summary', () => {
        expect(
            parse(new SaveDiaryMcpTool(), {
                summary: 'Finished MCP tool refactor with colocated tests.',
            }),
        ).toEqual({
            summary: 'Finished MCP tool refactor with colocated tests.',
        })
    })

    it('rejects short or sensitive save text', () => {
        expect(() =>
            parse(new SaveDiaryMcpTool(), {
                summary: 'too short',
            }),
        ).toThrow('content is too short to save')

        expect(() =>
            parse(new SaveDiaryMcpTool(), {
                summary: 'api_key = abcdefghijklmnopqrstuvwxyz',
            }),
        ).toThrow('content appears to contain a secret')
    })
})

function parse(tool: { inputSchema: McpInputSchema }, input: unknown) {
    const schema = tool.inputSchema
    if (!(schema instanceof z.ZodType)) {
        throw new Error('Expected a Zod schema')
    }

    return schema.parse(input)
}

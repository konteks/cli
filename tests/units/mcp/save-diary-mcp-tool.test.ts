import { describe, expect, it } from 'bun:test'
import type z from 'zod'
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

function parse(tool: { inputSchema: z.ZodObject }, input: unknown) {
    return tool.inputSchema.parse(input)
}

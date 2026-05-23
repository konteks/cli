import { describe, expect, it } from 'bun:test'
import toCallToolResult from '@/entrypoints/mcp/tools/_support/to-call-tool-result'

describe('MCP tool output formatting', () => {
    it('converts strings to MCP tool text without TOON encoding', () => {
        expect(toCallToolResult('plain output')).toEqual({
            content: [{ text: 'plain output', type: 'text' }],
        })
    })

    it('converts compacted objects to TOON MCP tool text', () => {
        const result = toCallToolResult({
            empty: [],
            nested: {
                omitted: undefined,
            },
            present: {
                value: 'kept',
            },
            summary: 'saved',
            tags: ['one', 'two'],
        })
        const text = extractText(result)

        expect(text).toContain('summary: saved')
        expect(text).toContain('present:')
        expect(text).toContain('value: kept')
        expect(text).toContain('tags[2]: one,two')
        expect(text).not.toContain('empty')
        expect(text).not.toContain('nested')
        expect(text).not.toContain('omitted')
    })
})

function extractText(result: ReturnType<typeof toCallToolResult>): string {
    const item = result.content[0]
    if (!item || item.type !== 'text') {
        throw new Error('Expected text content')
    }

    return item.text
}

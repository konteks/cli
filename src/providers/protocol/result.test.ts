import { describe, expect, it } from 'bun:test'
import { formatToTextResult } from './result'

describe('providers/protocol/result', () => {
    it('wraps plain text as an MCP text result', () => {
        expect(formatToTextResult('hello')).toEqual({
            content: [{ text: 'hello', type: 'text' }],
        })
    })

    it('encodes objects as TOON text results', () => {
        const [content] = formatToTextResult({ ok: true }).content

        expect(content?.type).toBe('text')
        expect(content?.type === 'text' ? content.text : '').toContain(
            'ok: true',
        )
    })
})

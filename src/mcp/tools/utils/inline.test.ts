import { describe, expect, it } from 'bun:test'
import inline from './inline'

describe('inline', () => {
    it('trims text and collapses whitespace', () => {
        expect(inline('  one\n\t two   three  ')).toBe('one two three')
    })
})

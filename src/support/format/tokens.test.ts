import { describe, expect, it } from 'bun:test'
import { estimateCharacterTokens, estimateTextTokens } from './tokens'

describe('support/format/tokens', () => {
    it.each([
        ['', 0],
        ['one', 2],
        ['one two three', 4],
        [' one   two ', 3],
    ])('estimates word-like tokens for %p', (text, expected) => {
        expect(estimateTextTokens(text)).toBe(expected)
    })

    it('estimates character tokens with a minimum per value', () => {
        expect(estimateCharacterTokens(['', 'abcd', 'abcde'])).toBe(4)
    })
})

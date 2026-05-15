import { describe, expect, it } from 'bun:test'
import toBullets from './to-bullets'

describe('toBullets', () => {
    it('formats values as indented bullets with inline text', () => {
        expect(toBullets([' first\nitem ', 'second   item'], 4)).toEqual([
            '    - first item',
            '    - second item',
        ])
    })

    it('returns a none bullet for empty values by default', () => {
        expect(toBullets([], 2)).toEqual(['  - none'])
    })

    it('can suppress empty bullets', () => {
        expect(toBullets([], 2, { empty: false })).toEqual([])
    })

    it('limits output to ten bullets', () => {
        expect(
            toBullets(
                Array.from({ length: 12 }, (_, index) => `item ${index}`),
                0,
            ),
        ).toHaveLength(10)
    })
})

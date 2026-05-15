import { describe, expect, it } from 'bun:test'
import { formatBytes, formatInteger } from '@/support/format/number'

describe('support/format/number', () => {
    it.each([
        [0, '0 B'],
        [-1, '0 B'],
        [Number.NaN, '0 B'],
        [512, '512 B'],
        [1024, '1.0 KB'],
        [1536, '1.5 KB'],
        [1024 * 1024, '1.0 MB'],
        [1024 * 1024 * 1024, '1.0 GB'],
    ])('formats byte count %p as %p', (value, expected) => {
        expect(formatBytes(value)).toBe(expected)
    })

    it('formats integers with US grouping', () => {
        expect(formatInteger(1234567)).toBe('1,234,567')
    })
})

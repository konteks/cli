import { describe, expect, it } from 'bun:test'
import { isRecord } from '@/support/object/value'

describe('support/object/value', () => {
    it.each([
        [{}, true],
        [{ a: 1 }, true],
        [null, false],
        [[], false],
        ['value', false],
    ])('detects records for %p', (value, expected) => {
        expect(isRecord(value)).toBe(expected)
    })
})

import { describe, expect, it } from 'bun:test'
import { isRecord, replaceStringDeep } from '@/support/object/value'

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

    it('replaces strings recursively without changing non-strings', () => {
        expect(
            replaceStringDeep(
                {
                    keep: 1,
                    list: ['alpha', { nested: 'alpha beta' }],
                    value: 'alpha',
                },
                'alpha',
                'omega',
            ),
        ).toEqual({
            keep: 1,
            list: ['omega', { nested: 'omega beta' }],
            value: 'omega',
        })
    })
})

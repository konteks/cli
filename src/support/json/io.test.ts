import { describe, expect, it } from 'bun:test'
import { parseJsonInput, stringifyPretty } from './io'

describe('support/json/io', () => {
    it('pretty prints JSON with two-space indentation', () => {
        expect(stringifyPretty({ a: 1, nested: { b: true } })).toBe(
            '{\n  "a": 1,\n  "nested": {\n    "b": true\n  }\n}',
        )
    })

    it('parses empty, valid, and invalid JSON input', () => {
        expect(parseJsonInput()).toEqual({})
        expect(parseJsonInput('{"ok":true}')).toEqual({ ok: true })
        expect(() => parseJsonInput('{bad')).toThrow('Invalid JSON input:')
    })
})

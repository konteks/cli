import { describe, expect, it } from 'bun:test'
import printJson, { isRecord, parseJsonInput } from './print-json'

describe('support/cli/json-output', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['isRecord', isRecord, 'function'],
            ['parseJsonInput', parseJsonInput, 'function'],
            ['printJson', printJson, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'isRecord',
            'parseJsonInput',
            'printJson',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

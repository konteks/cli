import { describe, expect, it } from 'bun:test'
import { confirmInteractive } from './interactive-confirm'

describe('providers/cli/interactive-confirm', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['confirmInteractive', confirmInteractive, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['confirmInteractive'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

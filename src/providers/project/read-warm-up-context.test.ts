import { describe, expect, it } from 'bun:test'
import readWarmUpContext from './read-warm-up-context'

describe('providers/project/warm-up-context', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['readWarmUpContext', readWarmUpContext, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['readWarmUpContext'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

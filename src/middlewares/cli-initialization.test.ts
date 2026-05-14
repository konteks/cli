import { describe, expect, it } from 'bun:test'
import { ensureCliProjectInitialized } from './cli-initialization'

describe('middlewares/cli-initialization', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            [
                'ensureCliProjectInitialized',
                ensureCliProjectInitialized,
                'function',
            ],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'ensureCliProjectInitialized',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

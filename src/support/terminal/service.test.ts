import { describe, expect, it } from 'bun:test'
import { terminal } from './service'

describe('support/terminal/service', () => {
    it('matches the public runtime contract', () => {
        const cases = [['terminal', terminal, 'object']] as const

        expect(cases.map(([name]) => name)).toEqual(['terminal'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

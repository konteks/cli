import { describe, expect, it } from 'bun:test'
import { VERSION } from './version'

describe('support/version', () => {
    it('matches the public runtime contract', () => {
        const cases = [['VERSION', VERSION, 'string']] as const

        expect(cases.map(([name]) => name)).toEqual(['VERSION'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

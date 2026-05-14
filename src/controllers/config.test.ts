import { describe, expect, it } from 'bun:test'
import { configCommand } from './config'

describe('controllers/config', () => {
    it('matches the public runtime contract', () => {
        const cases = [['configCommand', configCommand, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['configCommand'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

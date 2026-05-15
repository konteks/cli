import { describe, expect, it } from 'bun:test'
import repairCommand from './repair-command'

describe('controllers/repair', () => {
    it('matches the public runtime contract', () => {
        const cases = [['repairCommand', repairCommand, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['repairCommand'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

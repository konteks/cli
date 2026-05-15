import { describe, expect, it } from 'bun:test'
import forgetMemory from './forget-memory'

describe('providers/persistence/sqlite/forget-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [['forgetMemory', forgetMemory, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['forgetMemory'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

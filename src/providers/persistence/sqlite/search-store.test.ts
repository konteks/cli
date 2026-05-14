import { describe, expect, it } from 'bun:test'
import { searchMemory } from './search-store'

describe('providers/persistence/sqlite/search-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [['searchMemory', searchMemory, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['searchMemory'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

import { describe, expect, it } from 'bun:test'
import { SQLiteMemoryRepository } from './sqlite-memory-repository'

describe('providers/persistence/sqlite/sqlite-memory-repository', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['SQLiteMemoryRepository', SQLiteMemoryRepository, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['SQLiteMemoryRepository'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

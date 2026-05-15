import { describe, expect, it } from 'bun:test'
import DatabaseService from './database-service'

describe('providers/persistence/sqlite/db', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['DatabaseService', DatabaseService, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['DatabaseService'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

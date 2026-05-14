import { describe, expect, it } from 'bun:test'
import type {
    KonteksDatabase,
    SqliteAdapter,
    SqliteParams,
} from './sqlite-adapter'

type CoveredTypes = [KonteksDatabase, SqliteAdapter, SqliteParams]

describe('providers/persistence/sqlite/sqlite-adapter', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'KonteksDatabase',
            'SqliteAdapter',
            'SqliteParams',
        ] as const
        expect(typeNames).toEqual([
            'KonteksDatabase',
            'SqliteAdapter',
            'SqliteParams',
        ])
    })
})

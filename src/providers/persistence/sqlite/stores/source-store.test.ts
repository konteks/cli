import { describe, expect, it } from 'bun:test'
import type { SourceRow } from './source-store'
import { SourceStore } from './source-store'

type CoveredTypes = [SourceRow]

describe('providers/persistence/sqlite/stores/source-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [['SourceStore', SourceStore, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['SourceStore'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['SourceRow'] as const
        expect(typeNames).toEqual(['SourceRow'])
    })
})

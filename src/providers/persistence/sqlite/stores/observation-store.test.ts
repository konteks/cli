import { describe, expect, it } from 'bun:test'
import type { ObservationRow } from './observation-store'
import ObservationStore from './observation-store'

type CoveredTypes = [ObservationRow]

describe('providers/persistence/sqlite/stores/observation-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['ObservationStore', ObservationStore, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['ObservationStore'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['ObservationRow'] as const
        expect(typeNames).toEqual(['ObservationRow'])
    })
})

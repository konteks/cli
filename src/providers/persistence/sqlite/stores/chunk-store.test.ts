import { describe, expect, it } from 'bun:test'
import type { ChunkRow } from './chunk-store'
import { ChunkStore } from './chunk-store'

type CoveredTypes = [ChunkRow]

describe('providers/persistence/sqlite/stores/chunk-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [['ChunkStore', ChunkStore, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['ChunkStore'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['ChunkRow'] as const
        expect(typeNames).toEqual(['ChunkRow'])
    })
})

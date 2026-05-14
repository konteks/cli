import { describe, expect, it } from 'bun:test'
import type { ModuleRow } from './module-store'
import { ModuleStore } from './module-store'

type CoveredTypes = [ModuleRow]

describe('providers/persistence/sqlite/stores/module-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [['ModuleStore', ModuleStore, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['ModuleStore'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['ModuleRow'] as const
        expect(typeNames).toEqual(['ModuleRow'])
    })
})

import { describe, expect, it } from 'bun:test'
import type { RepairMemoryOptions, RepairMemoryResult } from './memory-repair'
import { repairMemory } from './memory-repair'

type CoveredTypes = [RepairMemoryOptions, RepairMemoryResult]

describe('composition/memory-repair', () => {
    it('matches the public runtime contract', () => {
        const cases = [['repairMemory', repairMemory, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['repairMemory'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['RepairMemoryOptions', 'RepairMemoryResult'] as const
        expect(typeNames).toEqual(['RepairMemoryOptions', 'RepairMemoryResult'])
    })
})

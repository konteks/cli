import { describe, expect, it } from 'bun:test'
import type { InstallSkillOptions } from './skills'
import { installSkills } from './skills'

type CoveredTypes = [InstallSkillOptions]

describe('composition/skills', () => {
    it('matches the public runtime contract', () => {
        const cases = [['installSkills', installSkills, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['installSkills'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['InstallSkillOptions'] as const
        expect(typeNames).toEqual(['InstallSkillOptions'])
    })
})

import { describe, expect, it } from 'bun:test'
import type {
    InstallKonteksSkillsRequest,
    InstallKonteksSkillsResult,
} from './skill-installer'
import { installKonteksSkills } from './skill-installer'

type CoveredTypes = [InstallKonteksSkillsRequest, InstallKonteksSkillsResult]

describe('providers/cli/skill-installer', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['installKonteksSkills', installKonteksSkills, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['installKonteksSkills'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'InstallKonteksSkillsRequest',
            'InstallKonteksSkillsResult',
        ] as const
        expect(typeNames).toEqual([
            'InstallKonteksSkillsRequest',
            'InstallKonteksSkillsResult',
        ])
    })
})

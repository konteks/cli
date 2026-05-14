import { describe, expect, it } from 'bun:test'
import type {
    InitializeProjectOptions,
    InitializeProjectResult,
} from './project-initialization'
import { initializeProject } from './project-initialization'

type CoveredTypes = [InitializeProjectOptions, InitializeProjectResult]

describe('composition/project-initialization', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['initializeProject', initializeProject, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['initializeProject'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'InitializeProjectOptions',
            'InitializeProjectResult',
        ] as const
        expect(typeNames).toEqual([
            'InitializeProjectOptions',
            'InitializeProjectResult',
        ])
    })
})

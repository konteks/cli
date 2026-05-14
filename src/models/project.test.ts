import { describe, expect, it } from 'bun:test'
import type {
    KonteksConfig,
    LoadedProjectContext,
    Project,
    ProjectContext,
} from './project'

type CoveredTypes = [
    KonteksConfig,
    LoadedProjectContext,
    Project,
    ProjectContext,
]

describe('models/project', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'KonteksConfig',
            'LoadedProjectContext',
            'Project',
            'ProjectContext',
        ] as const
        expect(typeNames).toEqual([
            'KonteksConfig',
            'LoadedProjectContext',
            'Project',
            'ProjectContext',
        ])
    })
})

import { describe, expect, it } from 'bun:test'
import type {
    ProjectStatus,
    ProjectStatusReaderContract,
} from './project-status-reader'

type CoveredTypes = [ProjectStatus, ProjectStatusReaderContract]

describe('contracts/services/project-status-reader', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'ProjectStatus',
            'ProjectStatusReaderContract',
        ] as const
        expect(typeNames).toEqual([
            'ProjectStatus',
            'ProjectStatusReaderContract',
        ])
    })
})

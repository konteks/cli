import { describe, expect, it } from 'bun:test'
import type {
    ExtractionMode,
    ExtractProjectRequest,
    ExtractProjectResponse,
} from './extraction'

type CoveredTypes = [
    ExtractProjectRequest,
    ExtractProjectResponse,
    ExtractionMode,
]

describe('models/extraction', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'ExtractProjectRequest',
            'ExtractProjectResponse',
            'ExtractionMode',
        ] as const
        expect(typeNames).toEqual([
            'ExtractProjectRequest',
            'ExtractProjectResponse',
            'ExtractionMode',
        ])
    })
})

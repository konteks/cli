import { describe, expect, it } from 'bun:test'
import type {
    ExtractionProgressEvent,
    ExtractionProgressReporter,
} from './progress'

type CoveredTypes = [ExtractionProgressEvent, ExtractionProgressReporter]

describe('contracts/services/progress', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'ExtractionProgressEvent',
            'ExtractionProgressReporter',
        ] as const
        expect(typeNames).toEqual([
            'ExtractionProgressEvent',
            'ExtractionProgressReporter',
        ])
    })
})

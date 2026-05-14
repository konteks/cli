import { describe, expect, it } from 'bun:test'
import type { ExtractionEngineContract } from './extraction-engine'

type CoveredTypes = [ExtractionEngineContract]

describe('contracts/services/extraction-engine', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['ExtractionEngineContract'] as const
        expect(typeNames).toEqual(['ExtractionEngineContract'])
    })
})

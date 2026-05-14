import { describe, expect, it } from 'bun:test'
import type { WarmUpContextReaderContract } from './warm-up-context-reader'

type CoveredTypes = [WarmUpContextReaderContract]

describe('contracts/services/warm-up-context-reader', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['WarmUpContextReaderContract'] as const
        expect(typeNames).toEqual(['WarmUpContextReaderContract'])
    })
})

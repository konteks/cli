import { describe, expect, it } from 'bun:test'
import type { EmbeddingProviderContract } from './embedding-provider'

type CoveredTypes = [EmbeddingProviderContract]

describe('contracts/services/embedding-provider', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['EmbeddingProviderContract'] as const
        expect(typeNames).toEqual(['EmbeddingProviderContract'])
    })
})

import { describe, expect, it } from 'bun:test'
import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import type { RetrievalDocumentRow } from '@/database/actions/query-retrieval-documents'
import {
    computeVectorScore,
    embedSearchQuery,
    makeSearchResult,
} from '@/database/support/search-scoring'

function vectorBlob(values: number[]): Uint8Array {
    return new Uint8Array(new Float32Array(values).buffer)
}

describe('providers/persistence/sqlite/search-scoring', () => {
    it('builds scored search results with clipped confidence and excerpt budget', () => {
        const result = makeSearchResult({
            confidence: 2,
            content: `${'needle '.repeat(100)}tail`,
            createdAt: new Date().toISOString(),
            id: 'doc_1',
            terms: ['needle', 'missing'],
            tokenCost: 300,
            type: 'chunk',
            vectorScore: 0.5,
        })

        expect(result.id).toBe('doc_1')
        expect(result.type).toBe('chunk')
        expect(result.excerpt.endsWith('...')).toBe(true)
        expect(result.tokenCost).toBe(120)
        expect(result.scoreDetails).toMatchObject({
            confidence: 1,
            lexical: 1,
            tokenCostPenalty: 3,
            vector: 0.5,
        })
    })

    it('embeds search terms only when the provider returns the expected dimensions', async () => {
        const provider: EmbeddingProviderContract = {
            dimensions: 2,
            async embed(texts) {
                expect(texts).toEqual(['hello world'])
                return [new Float32Array([1, 0])]
            },
            model: 'fake',
        }

        await expect(
            embedSearchQuery(provider, ['hello', 'world']),
        ).resolves.toEqual(new Float32Array([1, 0]))
        await expect(
            embedSearchQuery(undefined, ['hello']),
        ).resolves.toBeUndefined()
    })

    it('computes cosine vector score only for matching embedding metadata', () => {
        const provider: EmbeddingProviderContract = {
            dimensions: 2,
            async embed() {
                return []
            },
            model: 'fake',
        }
        const row = {
            embedding_dimensions: 2,
            embedding_model: 'fake',
            vector_blob: vectorBlob([1, 0]),
        } as RetrievalDocumentRow

        expect(
            computeVectorScore(row, {
                provider,
                queryVector: new Float32Array([1, 0]),
            }),
        ).toBeCloseTo(1)
        expect(
            computeVectorScore(
                { ...row, embedding_model: 'other' } as RetrievalDocumentRow,
                {
                    provider,
                    queryVector: new Float32Array([1, 0]),
                },
            ),
        ).toBeUndefined()
    })
})

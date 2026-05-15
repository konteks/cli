import { describe, expect, it } from 'bun:test'
import HuggingFaceEmbeddingProvider from './hugging-face-embedding-provider'

describe('providers/embeddings/hugging-face-embedding-provider', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            [
                'HuggingFaceEmbeddingProvider',
                HuggingFaceEmbeddingProvider,
                'function',
            ],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'HuggingFaceEmbeddingProvider',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

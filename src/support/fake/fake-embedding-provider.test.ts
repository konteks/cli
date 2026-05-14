import { describe, expect, it } from 'bun:test'
import { FakeEmbeddingProvider } from './fake-embedding-provider'

describe('support/fake/fake-embedding-provider', () => {
    it('returns deterministic normalized vectors with the configured dimensions', async () => {
        const provider = new FakeEmbeddingProvider(4)

        const [first, second, different] = await provider.embed([
            'same text',
            'same text',
            'different text',
        ])

        expect(provider.model).toBe('fake/all-MiniLM-L6-v2')
        expect(provider.dimensions).toBe(4)
        expect([...first]).toEqual([...second])
        expect([...first]).not.toEqual([...different])
        expect(
            Math.sqrt(
                [...first].reduce((total, value) => total + value ** 2, 0),
            ),
        ).toBeCloseTo(1)
    })
})

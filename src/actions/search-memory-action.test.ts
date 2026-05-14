import { describe, expect, it } from 'bun:test'
import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import { SearchMemoryAction } from './search-memory-action'

describe('actions/search-memory-action', () => {
    it('returns repository search results for the requested query', async () => {
        const input = { limit: 2, query: 'sqlite memory' }
        const results = [
            {
                createdAt: '2026-01-01T00:00:00.000Z',
                excerpt: 'SQLite memory result',
                id: 'obs_1',
                score: 42,
                type: 'memory' as const,
            },
        ]
        const repository = {
            async search(value: unknown) {
                expect(value).toBe(input)
                return results
            },
        } as MemoryRepositoryContract

        await expect(
            new SearchMemoryAction(repository).execute(input),
        ).resolves.toBe(results)
    })
})

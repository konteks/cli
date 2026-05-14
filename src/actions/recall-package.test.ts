import { describe, expect, it } from 'bun:test'
import type { MemorySearchResult } from '@/models/memory'
import { assembleRecallPackage } from './recall-package'

function memory(input: Partial<MemorySearchResult>): MemorySearchResult {
    return {
        createdAt: '2026-01-01T00:00:00.000Z',
        excerpt: 'Remember the SQLite implementation path.',
        id: 'obs_1',
        path: 'src/a.ts',
        score: 100,
        type: 'memory',
        ...input,
    }
}

describe('actions/recall-package', () => {
    it('deduplicates memories, compacts sources, and reports partial quality', () => {
        const first = memory({ id: 'obs_1', score: 120 })
        const duplicate = memory({ id: 'obs_1', score: 110 })
        const second = memory({
            excerpt: 'Inspect the recall package assembly.',
            id: 'chunk_1',
            path: 'src/b.ts',
            score: 90,
            type: 'chunk',
        })

        const result = assembleRecallPackage({
            graph: [],
            history: [],
            includeSources: false,
            maxTokens: 2000,
            memories: [first, duplicate, second],
            task: 'continue recall work',
        })

        expect(result.memories).toHaveLength(2)
        expect(result.primaryTargets).toEqual(['src/a.ts', 'src/b.ts'])
        expect(result.quality).toBe('partial')
        expect(result.sourceCount).toBe(2)
        expect(result.brief).toContain('Quality: partial.')
        expect(result.memories[0]).not.toHaveProperty('metadata')
    })

    it('keeps source detail when requested and caps graph/history evidence', () => {
        const result = assembleRecallPackage({
            graph: Array.from({ length: 8 }, (_, index) => ({
                depth: 1,
                direction: 'outgoing' as const,
                entityId: `e${index}`,
                entityName: `Entity ${index}`,
                entityType: 'module',
                predicate: 'uses',
                relatedEntityId: `r${index}`,
                relatedEntityName: `Related ${index}`,
                relatedEntityType: 'module',
                relationId: `rel_${index}`,
                score: 10,
            })),
            history: Array.from({ length: 6 }, (_, index) => ({
                objectEntityId: `o${index}`,
                objectEntityName: `Object ${index}`,
                predicate: 'replaced',
                reason: 'Included by test fixture.',
                relationId: `hist_${index}`,
                status: 'invalidated' as const,
                subjectEntityId: `s${index}`,
                subjectEntityName: `Subject ${index}`,
            })),
            includeSources: true,
            maxTokens: 2000,
            memories: [memory({ metadata: { tokenCost: 10 }, score: 220 })],
            task: 'why changed',
        })

        expect(result.graph).toHaveLength(8)
        expect(result.history).toHaveLength(6)
        expect(result.memories[0]?.metadata).toEqual({ tokenCost: 10 })
    })
})

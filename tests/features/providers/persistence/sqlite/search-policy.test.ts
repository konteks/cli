import { describe, expect, it } from 'bun:test'
import type { MemorySearchResult } from '@/models/memory'
import {
    allowResult,
    applyGroupAwarePruning,
    applyRolePolicy,
    compareSearchResults,
    detectIntent,
    toFtsQuery,
    tokenize,
} from '@/providers/persistence/sqlite/search-policy'

function result(input: Partial<MemorySearchResult>): MemorySearchResult {
    return {
        createdAt: '2026-01-01T00:00:00.000Z',
        excerpt: 'result',
        id: input.id ?? 'id',
        score: input.score ?? 10,
        type: input.type ?? 'memory',
        ...input,
    }
}

describe('providers/persistence/sqlite/search-policy', () => {
    it('tokenizes, deduplicates, cleans, and limits search terms', () => {
        expect(tokenize('Fix FIX src/app.ts, a x docs')).toEqual([
            'fix',
            'src/app.ts',
            'docs',
        ])
        expect(
            tokenize(
                'one two three four five six seven eight nine ten eleven twelve thirteen',
            ),
        ).toHaveLength(12)
    })

    it('builds quoted FTS queries from safe terms', () => {
        expect(toFtsQuery(['sqlite', 'src/app.ts', '---'])).toBe(
            '"sqlite" OR "srcappts"',
        )
        expect(toFtsQuery(['---'])).toBeUndefined()
    })

    it('detects recall intent and filters diary results for recall mode', () => {
        const intent = detectIntent('continue agent prompt fix')

        expect(intent).toEqual({
            allowsDiary: true,
            implementationTask: true,
            prefersAgentReference: true,
        })
        expect(allowResult(result({ type: 'diary' }), 'recall', intent)).toBe(
            true,
        )
        expect(
            allowResult(result({ type: 'diary' }), 'recall', {
                ...intent,
                allowsDiary: false,
            }),
        ).toBe(false)
        expect(
            allowResult(result({ type: 'diary' }), 'search', {
                ...intent,
                allowsDiary: false,
            }),
        ).toBe(true)
    })

    it('boosts implementation source results and demotes agent references', () => {
        expect(
            applyRolePolicy(
                result({
                    path: 'src/app.ts',
                    score: 10,
                    sourceRole: 'app_code',
                }),
                'recall',
                {
                    allowsDiary: false,
                    implementationTask: true,
                    prefersAgentReference: false,
                },
            ).score,
        ).toBe(50)
        expect(
            applyRolePolicy(
                result({ score: 100, sourceRole: 'agent_reference' }),
                'recall',
                {
                    allowsDiary: false,
                    implementationTask: false,
                    prefersAgentReference: false,
                },
            ).score,
        ).toBe(40)
    })

    it('sorts by score then recency and prunes per result type', () => {
        const sorted = [
            result({
                createdAt: '2026-01-01T00:00:00.000Z',
                id: 'older',
                score: 5,
            }),
            result({
                createdAt: '2026-01-02T00:00:00.000Z',
                id: 'newer',
                score: 5,
            }),
        ].sort(compareSearchResults)

        expect(sorted.map(item => item.id)).toEqual(['newer', 'older'])
        expect(
            applyGroupAwarePruning(
                Array.from({ length: 8 }, (_, index) =>
                    result({ id: `m${index}`, score: 100 - index }),
                ),
                'recall',
                10,
            ).map(item => item.id),
        ).toEqual(['m0', 'm1', 'm2', 'm3'])
    })
})

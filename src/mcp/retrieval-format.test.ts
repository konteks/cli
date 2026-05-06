import { describe, expect, it } from 'bun:test'
import type { MemorySearchResult } from '../memory/search-store.js'
import {
    formatRecallText,
    formatSearchText,
    formatWarmUpText,
} from './retrieval-format.js'

describe('retrieval formatter', () => {
    it('formats warm up text', () => {
        const text = formatWarmUpText({
            architecture: ['src/mcp: protocol layer'],
            constraints: ['Prefer repair only for recovery'],
            durableDecisions: ['Use WASM SQLite'],
            keyFiles: ['package.json'],
            summary: 'Konteks stores project memory locally.',
            technologies: ['typescript', 'mcp'],
        })

        expect(text).toContain('warm_up:')
        expect(text).toContain('technologies: typescript, mcp')
        expect(text).toContain('- src/mcp: protocol layer')
    })

    it('formats recall and search text', () => {
        const memories: MemorySearchResult[] = [
            {
                createdAt: new Date().toISOString(),
                excerpt: 'Auth refresh flow uses retry guard.',
                id: 'chunk_a',
                score: 140,
                scoreDetails: {
                    confidence: 1,
                    lexical: 2,
                    recency: 10,
                    tokenCostPenalty: 1,
                },
                tokenCost: 20,
                type: 'chunk',
            },
        ]

        const recall = formatRecallText({
            graphCount: 2,
            graphEvidence: ['Konteks stores_in .konteks (depth=1)'],
            historyCount: 1,
            historyEvidence: ['Konteks stores_in global-memory [superseded]'],
            memories,
            task: 'continue auth refresh fix',
        })
        const search = formatSearchText({
            limit: 5,
            query: 'auth refresh',
            results: memories,
        })

        expect(recall).toContain('recall:')
        expect(recall).toContain('task: continue auth refresh fix')
        expect(recall).toContain('graph_evidence:')
        expect(recall).toContain('history_evidence:')
        expect(search).toContain('search:')
        expect(search).toContain('query: auth refresh')
    })
})

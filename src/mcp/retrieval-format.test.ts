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
            description: 'Konteks stores project memory locally.',
            entryPoints: ['src/index.ts'],
            guidance: [
                {
                    kind: 'decision',
                    text: 'Use WASM SQLite',
                },
                {
                    kind: 'constraint',
                    text: 'Prefer repair only for recovery',
                },
                {
                    kind: 'convention',
                    text: 'Use functional patterns',
                },
            ],
            highlights: [
                {
                    excerpt: 'protocol layer',
                    id: 'module_src_mcp',
                    path: 'src/mcp',
                    score: 124,
                    scoreDetails: {
                        importance: 80,
                        recency: 10,
                        role: 35,
                        tokenCostPenalty: 1,
                    },
                    sourceRole: 'app_code',
                    tokenCost: 20,
                    type: 'module',
                },
            ],
            summary: 'warm-up-fixture',
            technologies: ['typescript', 'mcp'],
        })

        expect(text).toContain('warm_up:')
        expect(text).toContain('stack: typescript, mcp')
        expect(text).toContain('entry: src/index.ts')
        expect(text).toContain(
            'description: Konteks stores project memory locally.',
        )
        expect(text).toContain('highlights:')
        expect(text).toContain('[module] score=124 src/mcp role=app_code')
        expect(text).not.toContain('key_files:')
        expect(text).not.toContain('arch:')
        expect(text).toContain('guidance:')
        expect(text).toContain('- [decision] Use WASM SQLite')
        expect(text).toContain('- [constraint] Prefer repair only for recovery')
        expect(text).toContain('- [convention] Use functional patterns')
        expect(text).not.toContain('decisions:')
        expect(text).not.toContain('constraints:')
        expect(text).not.toContain('conventions:')
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
            brief: ['Inspect first: src/auth.ts'],
            graphCount: 2,
            graphEvidence: ['Konteks stores_in .konteks (depth=1)'],
            historyCount: 1,
            historyEvidence: ['Konteks stores_in global-memory [superseded]'],
            memories,
            primaryTargets: ['src/auth.ts'],
            task: 'continue auth refresh fix',
        })
        const search = formatSearchText({
            limit: 5,
            query: 'auth refresh',
            results: memories,
        })

        expect(recall).toContain('recall:')
        expect(recall).toContain('task: continue auth refresh fix')
        expect(recall).toContain('primary_targets:')
        expect(recall).toContain('score=140')
        expect(recall).toContain('graph_evidence:')
        expect(recall).toContain('history_evidence:')
        expect(search).toContain('search:')
        expect(search).toContain('query: auth refresh')
    })

    it('omits empty recall evidence sections', () => {
        const recall = formatRecallText({
            brief: ['Evidence: none found.'],
            graphCount: 0,
            graphEvidence: [],
            historyCount: 0,
            historyEvidence: [],
            memories: [],
            primaryTargets: [],
            task: 'unknown task',
        })

        expect(recall).toContain(
            'evidence_counts: memories=0, graph=0, history=0',
        )
        expect(recall).not.toContain('graph_evidence:')
        expect(recall).not.toContain('history_evidence:')
        expect(recall).not.toContain('- -')
    })
})

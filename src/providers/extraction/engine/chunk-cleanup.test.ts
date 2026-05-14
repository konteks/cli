import { describe, expect, it } from 'bun:test'
import {
    clearExtractedChunks,
    clearExtractedChunksForPaths,
    isExtractedChunkSuppressed,
} from './chunk-cleanup'

describe('providers/extraction/engine/chunk-cleanup', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['clearExtractedChunks', clearExtractedChunks, 'function'],
            [
                'clearExtractedChunksForPaths',
                clearExtractedChunksForPaths,
                'function',
            ],
            [
                'isExtractedChunkSuppressed',
                isExtractedChunkSuppressed,
                'function',
            ],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'clearExtractedChunks',
            'clearExtractedChunksForPaths',
            'isExtractedChunkSuppressed',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

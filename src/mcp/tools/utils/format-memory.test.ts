import { describe, expect, it } from 'bun:test'
import type { MemorySearchResult } from '@/models/memory'
import formatMemory from './format-memory'

describe('formatMemory', () => {
    it('formats memory result location, role, score, and summary', () => {
        expect(formatMemory(memoryResult(), 2)).toBe(
            '  - [memory] score=120 src/main.ts#L10 role=decision :: Refactor command layer',
        )
    })

    it('falls back to id and kind when path, anchor, or source role are missing', () => {
        expect(
            formatMemory(
                {
                    ...memoryResult(),
                    anchor: undefined,
                    kind: 'note',
                    path: undefined,
                    sourceRole: undefined,
                },
                0,
            ),
        ).toBe(
            '- [memory] score=120 memory-1 role=note :: Refactor command layer',
        )
    })

    it('includes source id and token cost when requested', () => {
        expect(formatMemory(memoryResult(), 0, true)).toBe(
            '- [memory] score=120 src/main.ts#L10 role=decision :: Refactor command layer id=memory-1 tokens=42',
        )
    })
})

function memoryResult(): MemorySearchResult {
    return {
        anchor: 'L10',
        createdAt: '2026-05-16T00:00:00.000Z',
        excerpt: ' Refactor\n command   layer ',
        id: 'memory-1',
        path: 'src/main.ts',
        score: 120,
        sourceRole: 'decision',
        tokenCost: 42,
        type: 'memory',
    }
}

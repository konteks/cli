import { describe, expect, it } from 'bun:test'
import formatMemory from '@/mcp/tools/utils/format-memory'
import inline from '@/mcp/tools/utils/inline'
import toBullets from '@/mcp/tools/utils/to-bullets'
import type { MemorySearchResult } from '@/models/memory'

describe('MCP tool output formatting', () => {
    it('normalizes inline text used by MCP output', () => {
        expect(inline('  one\n\t two   three  ')).toBe('one two three')
    })

    it('formats bounded bullet lists', () => {
        expect(toBullets([' first\nitem ', 'second   item'], 4)).toEqual([
            '    - first item',
            '    - second item',
        ])
        expect(toBullets([], 2)).toEqual(['  - none'])
        expect(toBullets([], 2, { empty: false })).toEqual([])
        expect(
            toBullets(
                Array.from({ length: 12 }, (_, index) => `item ${index}`),
                0,
            ),
        ).toHaveLength(10)
    })

    it('formats memory result location, role, score, and summary', () => {
        expect(formatMemory(memoryResult(), 2)).toBe(
            '  - [memory] score=120 src/main.ts#L10 role=decision :: Refactor command layer',
        )
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

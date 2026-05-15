import { describe, expect, it } from 'bun:test'
import sectionFile from '@/providers/extraction/engine/section-file'
import TreeSitterEngine from '@/providers/extraction/engine/tree-sitter-engine'

describe('TreeSitterEngine', () => {
    it('fails when a matching grammar is not loaded', async () => {
        const engine = new TreeSitterEngine()
        await engine.init()

        await expect(
            engine.parse('test.ts', 'export function createUser() {}'),
        ).rejects.toThrow('Tree-sitter grammar is not loaded for typescript')
    })

    it('falls back to heuristic when no parsed metadata is provided', async () => {
        const code = 'export const x = 1\nexport const y = 2'
        const sections = await sectionFile(
            {
                contentHash: 'hash',
                mtimeMs: 0,
                path: 'test.ts',
                sizeBytes: 100,
            },
            code,
        )

        expect(sections.length).toBe(2)
        expect(sections[0].anchor).toBe('x')
        expect(sections[1].anchor).toBe('y')
    })
})

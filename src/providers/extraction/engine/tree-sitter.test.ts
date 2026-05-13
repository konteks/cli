import { describe, expect, it } from 'bun:test'
import { chunkFile } from './chunking'
import { TreeSitterEngine } from './tree-sitter-engine'

describe('TreeSitterEngine', () => {
    it('returns no metadata when a matching grammar is not loaded', async () => {
        const engine = new TreeSitterEngine()
        await engine.init()

        const metadata = await engine.parse(
            'test.ts',
            'export function createUser() {}',
        )

        expect(metadata).toBeUndefined()
    })

    it('falls back to heuristic when engine is missing or fails', async () => {
        const code = 'export const x = 1\nexport const y = 2'
        const chunks = await chunkFile(
            {
                contentHash: 'hash',
                mtimeMs: 0,
                path: 'test.ts',
                sizeBytes: 100,
            },
            code,
        )

        expect(chunks.length).toBe(2)
        expect(chunks[0].anchor).toBe('x')
        expect(chunks[1].anchor).toBe('y')
    })
})

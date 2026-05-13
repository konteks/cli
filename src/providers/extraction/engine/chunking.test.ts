import { describe, expect, it } from 'bun:test'
import { chunkFile } from './chunking'

const file = {
    contentHash: 'hash',
    mtimeMs: 0,
    path: 'src/example.ts',
    sizeBytes: 100,
}

describe('chunkFile', () => {
    it('creates stable symbol anchors for heuristic code chunks', async () => {
        const chunks = await chunkFile(
            file,
            `
export function alpha() {
  return 1
}

export const beta = 2
`,
        )

        expect(chunks.map(chunk => chunk.anchor)).toEqual(['alpha', 'beta'])
        expect(chunks.every(chunk => chunk.anchorType === 'symbol')).toBe(true)
    })

    it('creates heading and JSON path anchors', async () => {
        const markdown = await chunkFile(
            { ...file, path: 'README.md' },
            '# Intro\nHello\n\n## Usage\nRun it\n',
        )
        const json = await chunkFile(
            { ...file, path: 'package.json' },
            '{"name":"fixture","scripts":{"test":"bun test"}}',
        )

        expect(markdown.map(chunk => chunk.anchor)).toEqual(['intro', 'usage'])
        expect(json.map(chunk => chunk.anchor)).toEqual(['name', 'scripts'])
    })

    it('chunks Markdown without a loaded Tree-sitter grammar', async () => {
        const chunks = await chunkFile(
            { ...file, path: 'README.md' },
            '# Intro\nHello\n\n## Usage\nRun it\n',
        )

        expect(chunks).toHaveLength(2)
        expect(chunks.map(chunk => chunk.kind)).toEqual([
            'markdown',
            'markdown',
        ])
        expect(chunks.map(chunk => chunk.heading)).toEqual(['Intro', 'Usage'])
    })

    it('chunks non-JS Tree-sitter symbols from parsed metadata', async () => {
        const chunks = await chunkFile(
            { ...file, path: 'main.py' },
            'def build_user():\n    return {}\n',
            undefined,
            {
                exports: [],
                imports: [],
                language: 'python',
                symbols: [
                    {
                        content: 'def build_user():\n    return {}\n',
                        endLine: 1,
                        isExported: false,
                        kind: 'function',
                        name: 'build_user',
                        startLine: 0,
                    },
                ],
            },
        )

        expect(chunks.map(chunk => chunk.anchor)).toEqual(['build_user'])
        expect(chunks[0]?.metadata).toMatchObject({
            nodeKind: 'function',
            parserEngine: 'tree_sitter',
            parserStatus: 'ok',
        })
    })

    it('marks supported code as Tree-sitter processed when no symbols are found', async () => {
        const chunks = await chunkFile(
            { ...file, path: 'src/empty.ts' },
            'export {}\n',
            undefined,
            {
                exports: [],
                imports: [],
                language: 'typescript',
                symbols: [],
            },
        )

        expect(chunks).toHaveLength(1)
        expect(chunks[0]?.anchor).toBe('file')
        expect(chunks[0]?.metadata).toMatchObject({
            parserEngine: 'tree_sitter',
            parserStatus: 'ok',
        })
    })
})

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
})

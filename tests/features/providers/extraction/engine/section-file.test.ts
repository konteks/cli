import { describe, expect, it } from 'bun:test'
import sectionFile from '@/providers/extraction/engine/section-file'

const file = {
    contentHash: 'hash',
    mtimeMs: 0,
    path: 'src/example.ts',
    sizeBytes: 100,
}

describe('sectionFile', () => {
    it('creates stable symbol anchors for heuristic code sections', async () => {
        const sections = await sectionFile(
            file,
            `
export function alpha() {
  return 1
}

export const beta = 2
`,
        )

        expect(sections.map(section => section.anchor)).toEqual([
            'alpha',
            'beta',
        ])
        expect(sections.every(section => section.anchorType === 'symbol')).toBe(
            true,
        )
    })

    it('creates heading and JSON path anchors', async () => {
        const markdown = await sectionFile(
            { ...file, path: 'README.md' },
            '# Intro\nHello\n\n## Usage\nRun it\n',
        )
        const json = await sectionFile(
            { ...file, path: 'package.json' },
            '{"name":"fixture","scripts":{"test":"bun test"}}',
        )

        expect(markdown.map(section => section.anchor)).toEqual([
            'intro',
            'usage',
        ])
        expect(json.map(section => section.anchor)).toEqual(['name', 'scripts'])
    })

    it('sections Markdown without a loaded Tree-sitter grammar', async () => {
        const sections = await sectionFile(
            { ...file, path: 'README.md' },
            '# Intro\nHello\n\n## Usage\nRun it\n',
        )

        expect(sections).toHaveLength(2)
        expect(sections.map(section => section.kind)).toEqual([
            'markdown',
            'markdown',
        ])
        expect(sections.map(section => section.heading)).toEqual([
            'Intro',
            'Usage',
        ])
    })

    it('sections non-JS Tree-sitter symbols from parsed metadata', async () => {
        const sections = await sectionFile(
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

        expect(sections.map(section => section.anchor)).toEqual(['build_user'])
        expect(sections[0]?.metadata).toMatchObject({
            nodeKind: 'function',
            parserEngine: 'tree_sitter',
            parserStatus: 'ok',
        })
    })

    it('marks supported code as Tree-sitter processed when no symbols are found', async () => {
        const sections = await sectionFile(
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

        expect(sections).toHaveLength(1)
        expect(sections[0]?.anchor).toBe('file')
        expect(sections[0]?.metadata).toMatchObject({
            parserEngine: 'tree_sitter',
            parserStatus: 'ok',
        })
    })
})

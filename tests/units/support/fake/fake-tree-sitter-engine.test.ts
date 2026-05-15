import { describe, expect, it } from 'bun:test'
import FakeTreeSitterEngine from '@/support/fake/fake-tree-sitter-engine'

describe('support/fake/fake-tree-sitter-engine', () => {
    it('reports all languages as available and extracts simple declarations', async () => {
        const engine = new FakeTreeSitterEngine()

        expect(engine.hasLanguage()).toBe(true)
        await expect(
            engine.parse(
                'src/example.ts',
                'export function run() {}\nconst hidden = true\nclass Thing {}',
            ),
        ).resolves.toMatchObject({
            language: 'ts',
            symbols: [
                { isExported: true, name: 'run', startLine: 0 },
                { isExported: false, name: 'hidden', startLine: 1 },
                { isExported: false, name: 'Thing', startLine: 2 },
            ],
        })
    })
})

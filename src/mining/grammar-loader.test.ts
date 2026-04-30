import { describe, expect, it } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    getBundledGrammarManifest,
    initTreeSitterWithBundledGrammars,
} from './grammar-loader.js'

class MockTreeSitterEngine {
    readonly loaded: Array<{ lang: string; path: string }> = []
    initialized = false

    async init() {
        this.initialized = true
    }

    async loadLanguage(
        lang: 'javascript' | 'typescript' | 'tsx',
        wasmPath: string,
    ) {
        this.loaded.push({ lang, path: wasmPath })
    }
}

describe('grammar loader', () => {
    it('exposes bundled manifest entries for built-in grammars', () => {
        const manifest = getBundledGrammarManifest()

        expect(manifest.runtime).toContain('web-tree-sitter')
        expect(Object.keys(manifest.grammars).sort()).toEqual([
            'javascript',
            'tsx',
            'typescript',
        ])
    })

    it('loads grammars from configured grammar root', async () => {
        const tempRoot = await mkdir(
            join(tmpdir(), `konteks-grammar-root-${Date.now()}`),
            { recursive: true },
        )
        await mkdir(join(tempRoot, 'tree-sitter-javascript'), {
            recursive: true,
        })
        await mkdir(join(tempRoot, 'tree-sitter-typescript'), {
            recursive: true,
        })
        await writeFile(
            join(
                tempRoot,
                'tree-sitter-javascript',
                'tree-sitter-javascript.wasm',
            ),
            '',
        )
        await writeFile(
            join(
                tempRoot,
                'tree-sitter-typescript',
                'tree-sitter-typescript.wasm',
            ),
            '',
        )
        await writeFile(
            join(tempRoot, 'tree-sitter-typescript', 'tree-sitter-tsx.wasm'),
            '',
        )

        const originalRoot = process.env.KONTEKS_GRAMMAR_ROOT
        process.env.KONTEKS_GRAMMAR_ROOT = tempRoot
        try {
            const engine = new MockTreeSitterEngine()
            await initTreeSitterWithBundledGrammars(engine as never)

            expect(engine.initialized).toBeTrue()
            expect(engine.loaded.map(item => item.lang).sort()).toEqual([
                'javascript',
                'tsx',
                'typescript',
            ])
        } finally {
            if (originalRoot === undefined) {
                delete process.env.KONTEKS_GRAMMAR_ROOT
            } else {
                process.env.KONTEKS_GRAMMAR_ROOT = originalRoot
            }
        }
    })
})

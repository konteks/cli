import { describe, expect, it } from 'bun:test'
import {
    getBundledGrammarManifest,
    initTreeSitterWithBundledGrammars,
} from './grammar-loader.js'
import type { TreeSitterLanguage } from './tree-sitter-engine.js'

class MockTreeSitterEngine {
    readonly loaded: Array<{ lang: string; path: string }> = []
    initialized = false

    async init() {
        this.initialized = true
    }

    async loadLanguage(lang: TreeSitterLanguage, wasmPath: string) {
        this.loaded.push({ lang, path: wasmPath })
    }
}

describe('grammar loader', () => {
    it('exposes bundled manifest entries for built-in grammars', () => {
        const manifest = getBundledGrammarManifest()

        expect(manifest.runtime).toContain('web-tree-sitter')
        expect(Object.keys(manifest.grammars).sort()).toEqual([
            'html',
            'javascript',
            'jsdoc',
            'json',
            'php',
            'tsx',
            'typescript',
        ])
    })

    it('loads bundled grammars from package assets', async () => {
        const engine = new MockTreeSitterEngine()
        await initTreeSitterWithBundledGrammars(engine as never)

        expect(engine.initialized).toBeTrue()
        expect(engine.loaded.map(item => item.lang).sort()).toEqual([
            'html',
            'javascript',
            'jsdoc',
            'json',
            'php',
            'tsx',
            'typescript',
        ])
    })
})

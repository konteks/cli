import { describe, expect, it } from 'bun:test'
import {
    getBundledGrammarForPath,
    initTreeSitterWithBundledGrammars,
} from './grammar-loader'
import type { TreeSitterLanguage } from './tree-sitter-engine'

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

    it('routes paths through the bundled grammar registry', () => {
        expect(getBundledGrammarForPath('src/index.ts')?.language).toBe(
            'typescript',
        )
        expect(getBundledGrammarForPath('src/view.tsx')?.language).toBe('tsx')
        expect(getBundledGrammarForPath('src/index.js')?.language).toBe(
            'javascript',
        )
        expect(getBundledGrammarForPath('public/index.html')?.language).toBe(
            'html',
        )
        expect(getBundledGrammarForPath('composer.json')?.language).toBe('json')
        expect(getBundledGrammarForPath('index.php')?.language).toBe('php')
        expect(getBundledGrammarForPath('api.jsdoc')?.language).toBe('jsdoc')
        expect(getBundledGrammarForPath('Makefile')).toBeUndefined()
    })
})

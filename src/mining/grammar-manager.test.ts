import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { cp, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    addGrammar,
    getGlobalGrammarCacheDir,
    listGrammars,
    removeGrammar,
} from './grammar-manager.js'

let originalCacheDir: string | undefined
let originalGrammarRoot: string | undefined
let cacheDir: string
let grammarRoot: string

describe('grammar manager', () => {
    beforeEach(async () => {
        originalCacheDir = process.env.KONTEKS_GRAMMAR_CACHE_DIR
        originalGrammarRoot = process.env.KONTEKS_GRAMMAR_ROOT
        cacheDir = join(tmpdir(), `konteks-grammar-cache-${Date.now()}`)
        grammarRoot = join(tmpdir(), `konteks-grammar-root-${Date.now()}`)
        process.env.KONTEKS_GRAMMAR_CACHE_DIR = cacheDir
        process.env.KONTEKS_GRAMMAR_ROOT = grammarRoot
        await mkdir(join(grammarRoot, 'tree-sitter-javascript'), {
            recursive: true,
        })
        await mkdir(join(grammarRoot, 'tree-sitter-typescript'), {
            recursive: true,
        })
        await cp(
            join(
                process.cwd(),
                'node_modules',
                'tree-sitter-javascript',
                'tree-sitter-javascript.wasm',
            ),
            join(
                grammarRoot,
                'tree-sitter-javascript',
                'tree-sitter-javascript.wasm',
            ),
        )
        await cp(
            join(
                process.cwd(),
                'node_modules',
                'tree-sitter-typescript',
                'tree-sitter-typescript.wasm',
            ),
            join(
                grammarRoot,
                'tree-sitter-typescript',
                'tree-sitter-typescript.wasm',
            ),
        )
        await cp(
            join(
                process.cwd(),
                'node_modules',
                'tree-sitter-typescript',
                'tree-sitter-tsx.wasm',
            ),
            join(grammarRoot, 'tree-sitter-typescript', 'tree-sitter-tsx.wasm'),
        )
    })

    afterEach(() => {
        if (originalCacheDir === undefined) {
            delete process.env.KONTEKS_GRAMMAR_CACHE_DIR
        } else {
            process.env.KONTEKS_GRAMMAR_CACHE_DIR = originalCacheDir
        }
        if (originalGrammarRoot === undefined) {
            delete process.env.KONTEKS_GRAMMAR_ROOT
        } else {
            process.env.KONTEKS_GRAMMAR_ROOT = originalGrammarRoot
        }
    })

    it('lists bundled grammars', async () => {
        const list = await listGrammars()
        expect(list.map(item => item.language).sort()).toEqual([
            'javascript',
            'tsx',
            'typescript',
        ])
        expect(list.every(item => item.installed === false)).toBeTrue()
    })

    it('adds and removes grammar with installed metadata', async () => {
        await addGrammar('typescript')

        const installedList = await listGrammars()
        const typescript = installedList.find(
            item => item.language === 'typescript',
        )
        expect(typescript?.installed).toBeTrue()
        expect(typescript?.installedAt).toBeString()

        const metadataPath = join(getGlobalGrammarCacheDir(), 'installed.json')
        const metadataRaw = await readFile(metadataPath, 'utf8')
        expect(metadataRaw).toContain('"typescript"')

        await removeGrammar('typescript')
        const listAfterRemove = await listGrammars()
        const removed = listAfterRemove.find(
            item => item.language === 'typescript',
        )
        expect(removed?.installed).toBeFalse()
    })
})

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '@/providers/project/context'
import {
    getGrammarDefinition,
    getGrammarForPath,
    initTreeSitterWithSelectedGrammars,
    listGrammarDefinitions,
} from './grammar-loader'
import type { TreeSitterLanguage } from './tree-sitter-engine'

const tempDirs: string[] = []

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

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('grammar loader registry', () => {
    it('exposes a curated grammar registry', () => {
        const ids = listGrammarDefinitions().map(grammar => grammar.id)

        expect(ids).toContain('typescript')
        expect(ids).toContain('python')
        expect(ids).toContain('rust')
        expect(ids).toContain('dockerfile')
    })

    it('routes paths through the grammar registry', () => {
        expect(getGrammarForPath('src/index.ts')?.id).toBe('typescript')
        expect(getGrammarForPath('src/view.tsx')?.id).toBe('tsx')
        expect(getGrammarForPath('src/index.js')?.id).toBe('javascript')
        expect(getGrammarForPath('public/index.html')?.id).toBe('html')
        expect(getGrammarForPath('composer.json')?.id).toBe('json')
        expect(getGrammarForPath('index.php')?.id).toBe('php')
        expect(getGrammarForPath('api.py')?.id).toBe('python')
        expect(getGrammarForPath('Dockerfile')?.id).toBe('dockerfile')
        expect(getGrammarForPath('Makefile')).toBeUndefined()
    })

    it('validates known grammar ids', () => {
        expect(getGrammarDefinition('typescript')?.displayName).toBe(
            'TypeScript',
        )
        expect(getGrammarDefinition('not-real')).toBeUndefined()
    })

    it('loads selected grammars from cache without downloading', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-grammar-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, '.konteks', 'cache', 'grammars'), {
            recursive: true,
        })
        await writeFile(
            join(projectRoot, '.konteks', 'config.json'),
            JSON.stringify({
                extraction: {
                    grammars: {
                        selected: ['typescript'],
                        updateTtlHours: 24,
                    },
                },
            }),
        )
        await writeFile(
            join(
                projectRoot,
                '.konteks',
                'cache',
                'grammars',
                'typescript.wasm',
            ),
            'fake wasm',
        )
        await writeFile(
            join(projectRoot, '.konteks', 'cache', 'grammars', 'manifest.json'),
            JSON.stringify({
                grammars: {
                    typescript: {
                        checkedAt: new Date().toISOString(),
                        id: 'typescript',
                        package: 'tree-sitter-typescript',
                        sha256: 'fake',
                        version: '0.23.2',
                        wasmFile: 'typescript.wasm',
                    },
                },
                version: 1,
            }),
        )
        const project = await loadProjectContext(projectRoot)
        const engine = new MockTreeSitterEngine()

        const result = await initTreeSitterWithSelectedGrammars(engine, project)

        expect(result.loaded).toEqual(['typescript'])
        expect(engine.initialized).toBeTrue()
        expect(engine.loaded).toEqual([
            {
                lang: 'typescript',
                path: join(
                    projectRoot,
                    '.konteks',
                    'cache',
                    'grammars',
                    'typescript.wasm',
                ),
            },
        ])
    })
})

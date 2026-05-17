// @ts-nocheck
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import * as os from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    getGrammarForPath,
    initTreeSitterWithSelectedGrammars,
    listGrammarDefinitions,
} from '@/providers/extraction/engine/grammar-loader'
import { loadProjectContext } from '@/providers/project/context'

const tempDirs: string[] = []

class MockTreeSitterEngine {
    public readonly loaded: Array<{ lang: string; path: string }> = []
    public initialized = false

    public async init() {
        this.initialized = true
    }

    public async loadLanguage(lang: string, wasmPath: string) {
        this.loaded.push({ lang, path: wasmPath })
    }
}

afterEach(async () => {
    mock.restore()
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('grammar loader registry', () => {
    it('exposes a curated grammar registry', () => {
        const ids = listGrammarDefinitions().map(grammar => grammar.id)
        const sortedIds = [...ids].sort((left, right) =>
            left.localeCompare(right),
        )

        expect(ids).toEqual(sortedIds)
        expect(ids).toContain('typescript')
        expect(ids).toContain('python')
        expect(ids).toContain('rust')
        expect(ids).toContain('javascript')
        expect(ids).toContain('dart')
        expect(ids).not.toContain('json')
        expect(ids).not.toContain('yaml')
        expect(ids).not.toContain('toml')
        expect(ids).not.toContain('jsx')
        expect(ids).not.toContain('dockerfile')
    })

    it('routes paths through the grammar registry', () => {
        expect(getGrammarForPath('src/index.ts')?.id).toBe('typescript')
        expect(getGrammarForPath('src/view.tsx')?.id).toBe('tsx')
        expect(getGrammarForPath('src/index.js')?.id).toBe('javascript')
        expect(getGrammarForPath('src/component.jsx')?.id).toBe('javascript')
        expect(getGrammarForPath('public/index.html')?.id).toBe('html')
        expect(getGrammarForPath('lib/main.dart')?.id).toBe('dart')
        expect(getGrammarForPath('composer.json')?.id).toBe('json')
        expect(getGrammarForPath('pnpm-workspace.yaml')?.id).toBe('yaml')
        expect(getGrammarForPath('pyproject.toml')?.id).toBe('toml')
        expect(getGrammarForPath('index.php')?.id).toBe('php')
        expect(getGrammarForPath('api.py')?.id).toBe('python')
        expect(getGrammarForPath('Sources/App.swift')).toBeUndefined()
        expect(getGrammarForPath('schema.sql')).toBeUndefined()
        expect(getGrammarForPath('Dockerfile')).toBeUndefined()
        expect(getGrammarForPath('Makefile')).toBeUndefined()
    })

    it('loads selected grammars from cache without downloading', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-grammar-'))
        tempDirs.push(projectRoot)
        spyOn(os, 'homedir').mockReturnValue(projectRoot)
        const grammarCacheDir = join(
            projectRoot,
            '.cache',
            'konteks',
            'grammars',
        )
        await mkdir(grammarCacheDir, {
            recursive: true,
        })
        await mkdir(join(projectRoot, '.git'), {
            recursive: true,
        })
        await mkdir(join(projectRoot, '.konteks'), {
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
        await writeFile(join(grammarCacheDir, 'typescript.wasm'), 'fake wasm')
        await writeFile(
            join(grammarCacheDir, 'manifest.json'),
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
        const project = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        const engine = new MockTreeSitterEngine()

        const result = await initTreeSitterWithSelectedGrammars(engine, project)

        expect(result.loaded).toEqual(['typescript'])
        expect(engine.initialized).toBeTrue()
        expect(engine.loaded).toEqual([
            {
                lang: 'typescript',
                path: join(grammarCacheDir, 'typescript.wasm'),
            },
        ])
    })

    it('loads bundled grammars from package dependencies', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-grammar-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, '.git'), {
            recursive: true,
        })
        await mkdir(join(projectRoot, '.konteks'), {
            recursive: true,
        })
        await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
        const project = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        const engine = new MockTreeSitterEngine()

        const result = await initTreeSitterWithSelectedGrammars(
            engine,
            project,
            { paths: ['package.json'] },
        )

        expect(result.loaded).toEqual(['json'])
        expect(engine.initialized).toBeTrue()
        expect(engine.loaded).toEqual([
            {
                lang: 'json',
                path: expect.stringContaining(
                    'node_modules/tree-sitter-json/tree-sitter-json.wasm',
                ),
            },
        ])
    })
})

async function withProjectRoot<T>(
    projectRoot: string,
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(projectRoot)

    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}

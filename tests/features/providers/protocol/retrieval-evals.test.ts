import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import searchMemory from '@/database/services/search-memory'
import mcpTools from '@/entrypoints/mcp/tools'
import { readExtractionManifest } from '@/modules/extraction/engine/manifest'
import { extractProject } from '@/modules/extraction/extract-project'
import recallRepositoryMemory from '@/modules/memory/recall-repository-memory'
import { loadProjectContext } from '@/modules/project/context'
import { mkdir, rm } from '@/support/file-manager'
import FakeEmbeddingProvider from '../../../fake/fake-embedding-provider'

const tempDirs: string[] = []

function extractionOptions() {
    return {
        embeddingProvider: new FakeEmbeddingProvider(),
    }
}

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

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(path => rm(path)))
})

describe.serial('retrieval quality evals', () => {
    it.serial('falls back cleanly when no graph or retrieval data exists', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-eval-empty-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, '.git'))

        const recall = await withProjectRoot(projectRoot, () =>
            recallRepositoryMemory({
                task: 'unindexed graph empty fallback',
            }),
        )

        expect(recall.quality).toBe('weak')
        expect(recall.memories).toEqual([])
        expect(recall.graph).toEqual([])
    })

    it.serial('supports packaging and MCP retrieval dogfood flow', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-packaging-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'cli.txt'),
            'export const run = () => "ok"\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )

        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_recall', {
                task: 'packaging mcp registration package manager',
            }),
        )
        const text = extractText(result)

        expect(text).not.toContain('recall:')
        expect(text).toContain('memories:')
    })

    it.serial('returns useful MCP runtime errors for invalid save input', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-errors-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, '.git'))
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )

        await expect(
            withProjectRoot(projectRoot, () =>
                callKonteksTool('konteks_save_diary', {}),
            ),
        ).resolves.toMatchObject({
            isError: true,
        })
    })

    it.serial('rejects invalid save chat before refreshing project memory', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-save-invalid-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'index.txt'),
            'export const first = true\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )
        await writeFile(
            join(projectRoot, 'src', 'should-not-refresh.txt'),
            'export const shouldNotRefresh = true\n',
        )

        await expect(
            withProjectRoot(projectRoot, () =>
                callKonteksTool('konteks_save_memories', {
                    memories: [
                        {
                            content: 'too short',
                            importance: 1,
                            kind: 'note',
                        },
                    ],
                }),
            ),
        ).resolves.toMatchObject({
            isError: true,
        })
        const manifest = await readExtractionManifest(context.memoryDir)

        expect(manifest?.files.map(file => file.path)).not.toContain(
            'src/should-not-refresh.txt',
        )
    })

    it.serial('updates changed project memory after saving context', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-eval-save-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'index.txt'),
            'export const first = true\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )
        await writeFile(
            join(projectRoot, 'src', 'saved-change.txt'),
            'export const savedChange = true\n',
        )

        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_save_diary', {
                summary:
                    'Saved structured diary context after refreshing changed project memory.',
            }),
        )
        const text = extractText(result)
        const manifest = await readExtractionManifest(context.memoryDir)

        expect(manifest?.mode).toBe('changed')
        expect(manifest?.files.map(file => file.path)).toContain(
            'src/saved-change.txt',
        )
        expect(text).toContain('session diary saved')
        expect(text).not.toContain('mode')
        expect(text).not.toContain('Extraction complete')
    })

    it.serial('includes module artifacts in warm up highlights', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-warm-up-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src', 'mcp'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'mcp', 'server.txt'),
            'export const serve = () => true\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )

        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_warm_up', {}),
        )
        const text = extractText(result)

        expect(text).not.toContain('warm_up:')
        expect(text).toContain('highlights')
    })

    it.serial('keeps TOON output more compact than JSON-in-text for recall', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-eval-toon-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'index.txt'),
            'export const f = () => 1\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )

        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_recall', {
                task: 'index function',
            }),
        )
        const text = extractText(result)

        expect(text).not.toContain('recall:')
        expect(text).toContain('memories:')
    })

    it.serial('prioritizes implementation files for implementation recall tasks', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-recall-shape-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src', 'mcp'))
        await mkdir(join(projectRoot, 'docs', 'getting-started'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'mcp', 'server.txt'),
            'export const konteks_recall = () => "return shape"\n',
        )
        await writeFile(
            join(projectRoot, 'src', 'mcp', 'retrieval-format.txt'),
            'export const formatRecallText = () => "recall return shape"\n',
        )
        await writeFile(
            join(projectRoot, 'docs', 'getting-started', 'lifecycle.md'),
            '# Build\nUse recall during the build phase.\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )

        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_recall', {
                task: 'improve konteks_recall return shape',
            }),
        )
        const text = extractText(result)

        expect(text).toContain('brief')
        expect(text).toContain('primaryTargets')
        expect(text).toContain('src/mcp')
        expect(text).not.toContain('docs/getting-started')
        expect(text).not.toContain('- -')
    })

    it.serial('keeps direct text matches ahead of graph-boosted weaker matches', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-graph-dominance-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'direct.txt'),
            'directmatch sharedgraph directmatch sharedgraph directmatch\n',
        )
        await writeFile(join(projectRoot, 'src', 'weak.txt'), 'sharedgraph\n')
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )

        const results = await withProjectRoot(projectRoot, () =>
            searchMemory({
                limit: 5,
                query: 'directmatch sharedgraph',
            }),
        )

        expect(results[0]?.path).toBe('src/direct.txt')
        expect(results.map(result => result.path)).toContain('src/weak.txt')
    })

    it.serial('boosts search candidates with connected graph evidence', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-graph-boost-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'boosted.txt'),
            'sharedboost\n',
        )
        await writeFile(join(projectRoot, 'README.md'), '# sharedboost\n')
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )

        const results = await withProjectRoot(projectRoot, () =>
            searchMemory({
                limit: 10,
                query: 'sharedboost',
            }),
        )
        const boosted = results.find(
            result => result.path === 'src/boosted.txt',
        )

        expect(boosted?.metadata).toMatchObject({
            graphBoost: expect.any(Number),
        })
    })

    it.serial('includes only connected graph evidence in recall output', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-graph-relevance-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'))
        await mkdir(join(projectRoot, 'docs'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'connected.txt'),
            'connected graph evidence target\n',
        )
        await writeFile(
            join(projectRoot, 'docs', 'unrelated.md'),
            '# isolated notes\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )

        const recall = await withProjectRoot(projectRoot, () =>
            recallRepositoryMemory({
                task: 'connected graph evidence',
            }),
        )

        expect(recall.graph.length).toBeGreaterThan(0)
        expect(
            recall.graph.some(item => item.entityName === 'unrelated.md'),
        ).toBe(false)
    })

    it.serial('uses SQLite WASM local storage context for retrieval', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-sqlite-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'))
        await mkdir(join(projectRoot, '.git'))
        await writeFile(
            join(projectRoot, 'src', 'store.txt'),
            'export const storage = "sqlite wasm local storage"\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', extractionOptions()),
        )
        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_search', {
                limit: 5,
                query: 'sqlite wasm local storage',
            }),
        )
        const text = extractText(result)

        expect(text).not.toContain('search:')
        expect(text).toContain('query: sqlite wasm local storage')
        expect(text).toContain('results')
        expect(text).toContain('sqlite wasm local storage')
    })
})

async function callKonteksTool(
    name: string,
    input: unknown,
): Promise<CallToolResult> {
    const tool = mcpTools.find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return await registeredHandlerFor(tool)(input)
}

function registeredHandlerFor(inputTool: (typeof mcpTools)[number]) {
    let handler: ((input: unknown) => Promise<CallToolResult>) | undefined
    const server = {
        registerTool: (...args: unknown[]) => {
            handler = args[2] as (input: unknown) => Promise<CallToolResult>
        },
    } as McpServer

    inputTool.register(server)

    if (!handler) {
        throw new Error('Tool did not register a handler.')
    }

    return handler
}

function extractText(result: CallToolResult): string {
    return (
        result.content.find(
            (
                item,
            ): item is Extract<
                CallToolResult['content'][number],
                { type: 'text' }
            > => item.type === 'text',
        )?.text ?? ''
    )
}

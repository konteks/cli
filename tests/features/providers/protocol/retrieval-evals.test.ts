// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types'
import actionDb from '@/database/actions/_db'
import mcpTools from '@/mcp/tools'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { extractProject } from '@/providers/extraction/extract-project'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import { loadProjectContext } from '@/providers/project/context'
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
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('retrieval quality evals', () => {
    it('supports packaging and MCP retrieval dogfood flow', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-packaging-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await mkdir(join(projectRoot, '.git'), { recursive: true })
        await writeFile(
            join(projectRoot, 'src', 'cli.txt'),
            'export const run = () => "ok"\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractProject(context, 'full', extractionOptions())
        await syncProjectActionDatabase(context)

        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_recall', {
                task: 'packaging mcp registration package manager',
            }),
        )
        const text = extractText(result)

        expect(text).toContain('recall:')
        expect(text).toContain('memories:')
    })

    it('returns useful MCP runtime errors for invalid save input', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-errors-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, '.git'), { recursive: true })
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractProject(context, 'full', extractionOptions())

        await expect(
            withProjectRoot(projectRoot, () =>
                callKonteksTool('konteks_save_diary', {}),
            ),
        ).resolves.toMatchObject({
            isError: true,
        })
    })

    it('rejects invalid save chat before refreshing project memory', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-save-invalid-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await mkdir(join(projectRoot, '.git'), { recursive: true })
        await writeFile(
            join(projectRoot, 'src', 'index.txt'),
            'export const first = true\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractProject(context, 'full', extractionOptions())
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

    it('updates changed project memory after saving context', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-eval-save-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await mkdir(join(projectRoot, '.git'), { recursive: true })
        await writeFile(
            join(projectRoot, 'src', 'index.txt'),
            'export const first = true\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractProject(context, 'full', extractionOptions())
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
        const adapter = await openProjectDatabase(context)
        const diaryRows = await adapter.adapter.query<{ summary: string }>(
            `
select summary
from diary_entries
order by created_at desc
limit 1
`,
        )
        await adapter.close()

        expect(manifest?.mode).toBe('changed')
        expect(manifest?.files.map(file => file.path)).toContain(
            'src/saved-change.txt',
        )
        expect(diaryRows[0]?.summary).toContain('src/saved-change.txt')
        expect(text).toContain('konteks: session diary saved')
        expect(text).not.toContain('mode')
        expect(text).not.toContain('Extraction complete')
    })

    it('includes module artifacts in warm up highlights', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-warm-up-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src', 'mcp'), { recursive: true })
        await mkdir(join(projectRoot, '.git'), { recursive: true })
        await writeFile(
            join(projectRoot, 'src', 'mcp', 'server.txt'),
            'export const serve = () => true\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractProject(context, 'full', extractionOptions())

        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_warm_up', {
                maxTokens: 600,
            }),
        )
        const text = extractText(result)

        expect(text).toContain('warm_up:')
        expect(text).toContain('highlights:')
    })

    it('keeps TOON output more compact than JSON-in-text for recall', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-eval-toon-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await mkdir(join(projectRoot, '.git'), { recursive: true })
        await writeFile(
            join(projectRoot, 'src', 'index.txt'),
            'export const f = () => 1\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractProject(context, 'full', extractionOptions())
        await syncProjectActionDatabase(context)

        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_recall', {
                task: 'index function',
            }),
        )
        const text = extractText(result)

        expect(text).toContain('recall:')
        expect(text).toContain('memories:')
    })

    it('prioritizes implementation files for implementation recall tasks', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-recall-shape-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src', 'mcp'), { recursive: true })
        await mkdir(join(projectRoot, 'docs', 'getting-started'), {
            recursive: true,
        })
        await mkdir(join(projectRoot, '.git'), { recursive: true })
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
        await extractProject(context, 'full', extractionOptions())
        await syncProjectActionDatabase(context)

        const result = await withProjectRoot(projectRoot, () =>
            callKonteksTool('konteks_recall', {
                task: 'improve konteks_recall return shape',
            }),
        )
        const text = extractText(result)

        expect(text).toContain('brief:')
        expect(text).toContain('primary_targets:')
        expect(text).toContain('src/mcp')
        expect(text).not.toContain('docs/getting-started')
        expect(text).not.toContain('- -')
    })

    it('uses SQLite WASM local storage context for retrieval', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-sqlite-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await mkdir(join(projectRoot, '.git'), { recursive: true })
        await writeFile(
            join(projectRoot, 'src', 'store.txt'),
            'export const storage = "sqlite wasm local storage"\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractProject(context, 'full', extractionOptions())
        const adapter = await openProjectDatabase(context)
        const rows = await adapter.adapter.query<{ count: number }>(
            'select count(*) as count from retrieval_documents',
        )
        await adapter.close()
        expect(rows[0]?.count).toBeGreaterThan(0)
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

async function syncProjectActionDatabase(
    context: Awaited<ReturnType<typeof loadProjectContext>>,
) {
    const service = await openProjectDatabase(context)
    await actionDb.syncTestActionDatabase(service.adapter)
    await service.close()
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

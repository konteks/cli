import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeEmbeddingProvider } from '../mining/embedding-provider.js'
import { readMineManifest } from '../mining/manifest.js'
import { mineProject } from '../mining/mine-project.js'
import { loadProjectContext } from '../project/context.js'
import { openProjectDatabase } from '../storage/database.js'
import { callMcpTool } from './server.js'

const tempDirs: string[] = []

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
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify(
                {
                    dependencies: { commander: '^14.0.0' },
                    name: 'packaging-fixture',
                    packageManager: 'bun@1.3.12',
                },
                null,
                2,
            ),
        )
        await writeFile(
            join(projectRoot, 'src', 'cli.ts'),
            'export const run = () => "ok"\n',
        )
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        const recall = await callMcpTool(
            { project: projectRoot },
            'konteks_recall',
            { task: 'packaging mcp registration package manager' },
        )
        const payload = (recall.structuredContent ?? {}) as Record<
            string,
            unknown
        >
        const memories = (payload.memories ?? []) as Array<
            Record<string, unknown>
        >

        expect(memories.length).toBeGreaterThan(0)
    })

    it('returns useful MCP runtime errors for invalid save input', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-errors-'),
        )
        tempDirs.push(projectRoot)
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        await expect(
            callMcpTool({ project: projectRoot }, 'konteks_save', {
                type: 'diary',
            }),
        ).rejects.toThrow('summary is required')
    })

    it('rejects invalid save chat before refreshing project memory', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-save-invalid-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({ name: 'invalid-save-refresh' }, null, 2),
        )
        await writeFile(
            join(projectRoot, 'src', 'index.ts'),
            'export const first = true\n',
        )
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })
        await writeFile(
            join(projectRoot, 'src', 'should-not-refresh.ts'),
            'export const shouldNotRefresh = true\n',
        )

        await expect(
            callMcpTool({ project: projectRoot }, 'konteks_save', {
                content: 'too short',
                kind: 'note',
                type: 'memory',
            }),
        ).rejects.toThrow('memory content is too short')
        const manifest = await readMineManifest(context.memoryDir)

        expect(manifest?.mode).toBe('full')
        expect(manifest?.files.map(file => file.path)).not.toContain(
            'src/should-not-refresh.ts',
        )
    })

    it('updates changed project memory after saving context', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-eval-save-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({ name: 'save-refresh' }, null, 2),
        )
        await writeFile(
            join(projectRoot, 'src', 'index.ts'),
            'export const first = true\n',
        )
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })
        await writeFile(
            join(projectRoot, 'src', 'saved-change.ts'),
            'export const savedChange = true\n',
        )

        const result = await callMcpTool(
            { project: projectRoot },
            'konteks_save',
            {
                summary:
                    'Saved structured diary context after refreshing changed project memory.',
                type: 'diary',
            },
        )
        const text = result.content.find(
            item => item.type === 'text' && 'text' in item,
        )?.text
        const manifest = await readMineManifest(context.memoryDir)
        const adapter = await openProjectDatabase(context)
        const diaryRows = await adapter.query<{ summary: string }>(
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
            'src/saved-change.ts',
        )
        expect(diaryRows[0]?.summary).toContain('src/saved-change.ts')
        expect(text).not.toContain('src/saved-change.ts')
        expect(text).not.toContain('mode')
        expect(text).not.toContain('Extraction complete')
    })

    it('includes module artifacts in warm up architecture context', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-warm-up-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src', 'mcp'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({ name: 'warm-up-arch' }, null, 2),
        )
        await writeFile(
            join(projectRoot, 'src', 'mcp', 'server.ts'),
            'export const serve = () => true\n',
        )
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        const warmUp = await callMcpTool(
            { project: projectRoot },
            'konteks_warm_up',
            { maxTokens: 600 },
        )
        const payload = (warmUp.structuredContent ?? {}) as Record<
            string,
            unknown
        >
        const architecture = (payload.architecture ?? []) as string[]

        expect(architecture.some(line => line.includes('src'))).toBe(true)
    })

    it('keeps TOON output more compact than JSON-in-text for recall', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-eval-toon-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({ name: 'toon-fixture' }, null, 2),
        )
        await writeFile(
            join(projectRoot, 'src', 'index.ts'),
            'export const f = () => 1\n',
        )
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        const recall = await callMcpTool(
            { project: projectRoot },
            'konteks_recall',
            { task: 'index function' },
        )
        const text = recall.content.find(
            item => item.type === 'text' && 'text' in item,
        )?.text
        const structured = JSON.stringify(
            recall.structuredContent ?? {},
            null,
            2,
        )

        expect((text ?? '').length).toBeLessThan(structured.length)
    })

    it('uses SQLite WASM local storage context for retrieval', async () => {
        const projectRoot = await mkdtemp(
            join(tmpdir(), 'konteks-eval-sqlite-'),
        )
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({ name: 'sqlite-fixture' }, null, 2),
        )
        await writeFile(
            join(projectRoot, 'src', 'store.ts'),
            'export const storage = "sqlite wasm local storage"\n',
        )
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })
        const adapter = await openProjectDatabase(context)
        const rows = await adapter.query<{ count: number }>(
            'select count(*) as count from retrieval_documents',
        )
        await adapter.close()
        expect(rows[0]?.count).toBeGreaterThan(0)
    })
})

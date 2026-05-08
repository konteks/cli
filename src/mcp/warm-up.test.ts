import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeEmbeddingProvider } from '../mining/embedding-provider.js'
import { readMineManifest } from '../mining/manifest.js'
import { mineProject } from '../mining/mine-project.js'
import { loadProjectContext } from '../project/context.js'
import { callMcpTool } from './server.js'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('konteks_warm_up', () => {
    it('returns stable project context assembled from stored artifacts', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-warm-up-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify(
                {
                    dependencies: { commander: '^14.0.0' },
                    name: 'warm-up-fixture',
                    packageManager: 'bun@1.3.12',
                },
                null,
                2,
            ),
        )
        await writeFile(
            join(projectRoot, 'src', 'index.ts'),
            'export const hello = () => "world"\n',
        )

        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })
        await callMcpTool({ project: projectRoot }, 'konteks_save', {
            memories: [
                {
                    content: 'Use Bun test for project verification.',
                    kind: 'preference',
                },
                {
                    content: 'Konteks save must preserve explicit constraints.',
                    kind: 'constraint',
                },
                {
                    content: 'Use structured save payloads for session memory.',
                    kind: 'decision',
                },
            ],
            type: 'memories',
        })

        const result = await callMcpTool(
            { project: projectRoot },
            'konteks_warm_up',
            { maxTokens: 500 },
        )
        const payload = (result.structuredContent ?? {}) as Record<
            string,
            unknown
        >

        expect(payload.summary).toEqual(expect.any(String))
        expect(payload.technologies).toEqual(
            expect.arrayContaining(['javascript', 'typescript']),
        )
        expect(payload.keyFiles).toBeUndefined()
        expect(payload.architecture).toBeUndefined()
        expect(payload.constraints).toBeUndefined()
        expect(payload.conventions).toBeUndefined()
        expect(payload.durableDecisions).toBeUndefined()
        expect(payload.highlights).toEqual(expect.any(Array))
        expect(
            (payload.highlights as Array<{ score?: number }>).some(
                highlight => typeof highlight.score === 'number',
            ),
        ).toBe(true)
        expect(payload.entryPoints).toEqual(expect.any(Array))
        expect(payload.guidance).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'convention',
                    text: 'Use Bun test for project verification.',
                }),
                expect.objectContaining({
                    kind: 'constraint',
                    text: 'Konteks save must preserve explicit constraints.',
                }),
                expect.objectContaining({
                    kind: 'decision',
                    text: 'Use structured save payloads for session memory.',
                }),
            ]),
        )
        expect(payload.freshness).toBeUndefined()
        expect(payload.recentChanges).toBeUndefined()
        expect(payload.recentHandoffs).toBeUndefined()
        expect(payload.commonCommands).toBeUndefined()
    })

    it('updates changed project memory before warming up', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-warm-up-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({ name: 'warm-up-refresh' }, null, 2),
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
            join(projectRoot, 'src', 'later.ts'),
            'export const later = true\n',
        )

        const result = await callMcpTool(
            { project: projectRoot },
            'konteks_warm_up',
            { maxTokens: 500 },
        )
        const text = result.content.find(
            item => item.type === 'text' && 'text' in item,
        )?.text
        const manifest = await readMineManifest(context.memoryDir)

        expect(manifest?.mode).toBe('changed')
        expect(manifest?.files.map(file => file.path)).toContain('src/later.ts')
        expect(text).not.toContain('mode:')
        expect(text).not.toContain('mined_at:')
        expect(text).not.toContain('Selected')
        expect(text).not.toContain('Extraction complete')
    })

    it('returns quality-labeled focused recall without duplicate targets', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-warm-up-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src', 'mcp'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({ name: 'warm-up-focused' }, null, 2),
        )
        await writeFile(
            join(projectRoot, 'src', 'mcp', 'server.ts'),
            'export const warmUpServer = () => "focused recall"\n',
        )
        await writeFile(
            join(projectRoot, 'src', 'mcp', 'retrieval-format.ts'),
            'export const formatWarmUpText = () => "focused recall"\n',
        )

        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        const result = await callMcpTool(
            { project: projectRoot },
            'konteks_warm_up',
            { maxTokens: 500, topic: 'focused recall warm up' },
        )
        const payload = (result.structuredContent ?? {}) as Record<
            string,
            unknown
        >
        const recall = payload.recall as
            | { primaryTargets: string[]; quality: string }
            | undefined
        const text = result.content.find(
            item => item.type === 'text' && 'text' in item,
        )?.text

        expect(recall).toBeDefined()
        if (!recall) {
            throw new Error('expected focused recall')
        }
        expect(recall?.quality).toMatch(/^(strong|partial|weak)$/)
        expect(recall.primaryTargets.length).toBeGreaterThan(0)
        expect(new Set(recall.primaryTargets).size).toBe(
            recall.primaryTargets.length,
        )
        expect(text).toContain('quality:')
    })

    it('fails with a short health error when memory is not initialized', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-warm-up-'))
        tempDirs.push(projectRoot)

        await expect(
            callMcpTool({ project: projectRoot }, 'konteks_warm_up', {}),
        ).rejects.toThrow('Konteks memory is not initialized')
    })
})

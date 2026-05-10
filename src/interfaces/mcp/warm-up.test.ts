import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FakeEmbeddingProvider } from '../../infrastructure/ai/hugging-face-embedding-provider.js'
import { loadProjectContext } from '../../infrastructure/file-system/context.js'
import { mineProject } from '../../infrastructure/mining/mine-project.js'
import { callMcpTool } from './server.js'

describe('konteks_warm_up', () => {
    let tempDirs: string[] = []

    afterEach(async () => {
        for (const dir of tempDirs) {
            await rm(dir, { force: true, recursive: true })
        }
        tempDirs = []
    })

    it('returns stable project context assembled from stored artifacts', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-warm-up-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify(
                {
                    dependencies: { typescript: '^5.0.0' },
                    name: 'warm-up-fixture',
                },
                null,
                2,
            ),
        )
        await writeFile(
            join(projectRoot, 'src', 'index.ts'),
            'export const version = "1.0.0"\n',
        )

        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })

        // Seed some durable memories
        await callMcpTool({ project: projectRoot }, 'konteks_save', {
            memories: [
                {
                    content: 'Use Bun test for project verification.',
                    kind: 'preference',
                    type: 'memory',
                },
                {
                    content: 'Konteks save must preserve explicit constraints.',
                    kind: 'constraint',
                    type: 'memory',
                },
                {
                    content: 'Use structured save payloads for session memory.',
                    kind: 'decision',
                    type: 'memory',
                },
                {
                    content:
                        'Patched warm-up formatter to collapse old sections.',
                    kind: 'fact',
                    type: 'memory',
                },
            ],
            type: 'memories',
        })

        const result = await callMcpTool(
            { project: projectRoot },
            'konteks_warm_up',
            { maxTokens: 500 },
        )
        const text =
            result.content.find(item => item.type === 'text' && 'text' in item)
                ?.text ?? ''

        expect(text).toContain('warm_up:')
        expect(text).toContain('summary:')
        expect(text).toContain('Use Bun test for project verification.')
        expect(text).toContain(
            'Konteks save must preserve explicit constraints.',
        )
        expect(text).toContain(
            'Use structured save payloads for session memory.',
        )
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
        const text =
            result.content.find(item => item.type === 'text' && 'text' in item)
                ?.text ?? ''

        expect(text).toContain('recall:')
        expect(text).toContain('quality:')
        expect(text).toContain('primary_targets:')
    })

    it('fails with a short health error when memory is not initialized', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-warm-up-'))
        tempDirs.push(projectRoot)

        await expect(
            callMcpTool({ project: projectRoot }, 'konteks_warm_up', {}),
        ).rejects.toThrow('Konteks memory is not initialized')
    })
})

async function readMineManifest(memoryDir: string) {
    const { readMineManifest: read } = await import(
        '../../infrastructure/mining/manifest.js'
    )
    return read(memoryDir)
}

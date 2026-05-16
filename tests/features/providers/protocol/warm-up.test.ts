// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types'
import mcpTools from '@/mcp/tools'
import type { StartMcpServerOptions } from '@/models/mcp'
import { extractProject } from '@/providers/extraction/extract-project'
import { loadProjectContext } from '@/providers/project/context'
import FakeEmbeddingProvider from '@/support/fake/fake-embedding-provider'
import FakeTreeSitterEngine from '@/support/fake/fake-tree-sitter-engine'

function mcpOptions(project: string) {
    return {
        project,
        treeSitterEngine: new FakeTreeSitterEngine() as never,
    }
}

function extractionOptions() {
    return {
        embeddingProvider: new FakeEmbeddingProvider(),
        treeSitterEngine: new FakeTreeSitterEngine() as never,
    }
}

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
        await extractProject(context, 'full', extractionOptions())

        // Seed some durable memories
        await callKonteksTool(
            mcpOptions(projectRoot),
            'konteks_save_memories',
            {
                memories: [
                    {
                        content: 'Use Bun test for project verification.',
                        importance: 3,
                        kind: 'preference',
                    },
                    {
                        content:
                            'Konteks save must preserve explicit constraints.',
                        importance: 4,
                        kind: 'constraint',
                    },
                    {
                        content:
                            'Use structured save payloads for session memory.',
                        importance: 5,
                        kind: 'decision',
                    },
                    {
                        content:
                            'Patched warm-up formatter to collapse old sections.',
                        importance: 2,
                        kind: 'fact',
                    },
                ],
            },
        )

        const result = await callKonteksTool(
            mcpOptions(projectRoot),
            'konteks_warm_up',
            { maxTokens: 500 },
        )
        const text = extractText(result)

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
        await extractProject(context, 'full', extractionOptions())
        await writeFile(
            join(projectRoot, 'src', 'later.ts'),
            'export const later = true\n',
        )

        const result = await callKonteksTool(
            mcpOptions(projectRoot),
            'konteks_warm_up',
            { maxTokens: 500 },
        )
        const text = extractText(result)
        const manifest = await readExtractionManifest(context.memoryDir)

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
        await extractProject(context, 'full', extractionOptions())

        const result = await callKonteksTool(
            mcpOptions(projectRoot),
            'konteks_warm_up',
            { maxTokens: 500, topic: 'focused recall warm up' },
        )
        const text = extractText(result)

        expect(text).toContain('recall:')
        expect(text).toContain('quality:')
        expect(text).toContain('primary_targets:')
    })
})

async function readExtractionManifest(memoryDir: string) {
    const { readExtractionManifest: read } = await import(
        '@/providers/extraction/engine/manifest'
    )
    return read(memoryDir)
}

async function callKonteksTool(
    options: StartMcpServerOptions,
    name: string,
    input: unknown,
): Promise<CallToolResult> {
    const tool = mcpTools.find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return await tool.handle(options, input)
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

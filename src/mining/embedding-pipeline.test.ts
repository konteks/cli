import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '../project/context.js'
import { openProjectDatabase } from '../storage/database.js'
import { generateTargetEmbeddings } from './embedding-pipeline.js'
import { FakeEmbeddingProvider } from './embedding-provider.js'
import { upsertRetrievalDocument } from './retrieval-documents.js'

const tempDirs: string[] = []

async function makeTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-embed-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    return projectRoot
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('generateTargetEmbeddings', () => {
    it('embeds retrieval documents and reuses by embedding hash', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)
        const adapter = await openProjectDatabase(context)

        await upsertRetrievalDocument(adapter, {
            embeddingText: 'summary: first chunk',
            ftsText: 'summary: first chunk',
            path: 'src/a.ts',
            sourceId: 'source_a',
            sourceRole: 'app_code',
            summary: 'first',
            targetId: 'chunk_a',
            targetType: 'chunk',
            updatedAt: new Date().toISOString(),
        })

        const provider = new FakeEmbeddingProvider(8)
        const first = await generateTargetEmbeddings(
            adapter,
            provider,
            ['chunk'],
            new Date().toISOString(),
        )

        expect(first.embeddedCount).toBe(1)
        expect(first.reusedCount).toBe(0)

        const second = await generateTargetEmbeddings(
            adapter,
            provider,
            ['chunk'],
            new Date().toISOString(),
        )

        expect(second.embeddedCount).toBe(0)
        expect(second.reusedCount).toBe(1)

        const rows = await adapter.query<{ dimensions: number; model: string }>(
            'select model, dimensions from target_embeddings where target_id = ? and target_type = ?',
            ['chunk_a', 'chunk'],
        )
        await adapter.close()

        expect(rows).toEqual([{ dimensions: 8, model: provider.model }])
    })
})

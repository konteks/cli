import { afterEach, describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/app/database/sqlite/database'
import { loadProjectContext } from '@/app/file-system/context'
import { upsertRetrievalDocument } from '@/app/mining/engine/retrieval-documents'
import { mkdir, mkdtemp, rm, writeFile } from '@/app/support/file-manager'
import { generateTargetEmbeddings } from './embedding-pipeline'
import { FakeEmbeddingProvider } from './hugging-face-embedding-provider'

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
        const service = await openProjectDatabase(context)

        await upsertRetrievalDocument(service, {
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
            service,
            provider,
            ['chunk'],
            new Date().toISOString(),
        )

        expect(first.embeddedCount).toBe(1)
        expect(first.reusedCount).toBe(0)

        const second = await generateTargetEmbeddings(
            service,
            provider,
            ['chunk'],
            new Date().toISOString(),
        )

        expect(second.embeddedCount).toBe(0)
        expect(second.reusedCount).toBe(1)

        const rows = await service.adapter.query<{
            dimensions: number
            model: string
            vector_blob: Uint8Array
        }>(
            'select model, dimensions, vector_blob from target_embeddings where target_id = ? and target_type = ?',
            ['chunk_a', 'chunk'],
        )
        await service.close()

        expect(rows[0]?.model).toBe(provider.model)
        expect(rows[0]?.dimensions).toBe(8)
        expect(rows[0]?.vector_blob.byteLength).toBe(8 * 4)
    })
})

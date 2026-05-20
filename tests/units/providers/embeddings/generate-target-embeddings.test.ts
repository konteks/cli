// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/database/actions/_db'
import generateTargetEmbeddings from '@/providers/embeddings/generate-target-embeddings'
import { querySql } from '@/providers/persistence/sqlite/libsql-helpers'
import { upsertRetrievalDocument } from '@/providers/persistence/sqlite/retrieval-documents'
import { loadProjectContext } from '@/providers/project/context'
import FakeEmbeddingProvider from '../../../fake/fake-embedding-provider'

const tempDirs: string[] = []

async function makeTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-embed-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    return projectRoot
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

describe('generateTargetEmbeddings', () => {
    it('embeds retrieval documents and reuses by embedding hash', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
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

        const rows = await querySql<{
            dimensions: number
            model: string
            vector_blob: Uint8Array
        }>(
            service.client,
            'select model, dimensions, vector_blob from target_embeddings where target_id = ? and target_type = ?',
            ['chunk_a', 'chunk'],
        )
        await service.close()

        expect(rows[0]?.model).toBe(provider.model)
        expect(rows[0]?.dimensions).toBe(8)
        expect(rows[0]?.vector_blob.byteLength).toBe(8 * 4)
    })
})

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import getDb from '@/database/actions/_db'
import {
    diaryEntries,
    observations,
    retrievalDocuments,
    targetEmbeddings,
} from '@/database/schema'
import {
    saveKonteksDiary,
    saveKonteksMemories,
} from '@/database/services/save-memory'
import { loadProjectContext } from '@/modules/project/context'
import type { EmbeddingProviderContract } from '@/types/embedding-provider'
import FakeEmbeddingProvider from '../../fake/fake-embedding-provider'

const tempDirs: string[] = []
let previousSqliteTestDatabase: string | undefined

class ThrowingEmbeddingProvider implements EmbeddingProviderContract {
    public readonly dimensions = 8
    public readonly model = 'fake/throwing'

    public async embed(): Promise<Float32Array[]> {
        throw new Error('embedding provider failed')
    }
}

beforeEach(() => {
    previousSqliteTestDatabase = process.env.KONTEKS_SQLITE_TEST_DATABASE
    process.env.KONTEKS_SQLITE_TEST_DATABASE = 'file'
})

afterEach(async () => {
    if (previousSqliteTestDatabase === undefined) {
        delete process.env.KONTEKS_SQLITE_TEST_DATABASE
    } else {
        process.env.KONTEKS_SQLITE_TEST_DATABASE = previousSqliteTestDatabase
    }

    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('save memory embeddings', () => {
    it('embeds a newly saved durable memory retrieval document', async () => {
        const projectRoot = await makeInitializedProject()

        await withProjectRoot(projectRoot, async () => {
            const context = await loadProjectContext()
            const result = await saveKonteksMemories(
                context,
                {
                    memories: [
                        {
                            content:
                                'New durable memories should be immediately available through semantic retrieval.',
                            importance: 4,
                            kind: 'decision',
                        },
                    ],
                },
                { embeddingProvider: new FakeEmbeddingProvider() },
            )

            const memoryIds = result.memoryIds
            expect(memoryIds).toHaveLength(1)
            if (!memoryIds?.[0]) {
                throw new Error('expected memory id')
            }
            const targetId = memoryIds[0]
            await expectTargetIndexed(targetId, 'memory')
        })
    })

    it('does not embed duplicate durable memories again', async () => {
        const projectRoot = await makeInitializedProject()

        await withProjectRoot(projectRoot, async () => {
            const context = await loadProjectContext()
            const input = {
                memories: [
                    {
                        content:
                            'Duplicate durable memory content should reuse the original saved observation.',
                        importance: 3 as const,
                        kind: 'fact' as const,
                    },
                ],
            }

            const first = await saveKonteksMemories(context, input, {
                embeddingProvider: new FakeEmbeddingProvider(),
            })
            const second = await saveKonteksMemories(context, input, {
                embeddingProvider: new FakeEmbeddingProvider(),
            })

            expect(second.memoryIds).toEqual(first.memoryIds)
            expect(await embeddingRowsFor('memory')).toHaveLength(1)
        })
    })

    it('keeps durable memory save successful when embedding fails', async () => {
        const projectRoot = await makeInitializedProject()

        await withProjectRoot(projectRoot, async () => {
            const context = await loadProjectContext()
            const result = await saveKonteksMemories(
                context,
                {
                    memories: [
                        {
                            content:
                                'Durable memory persistence should survive an embedding provider failure.',
                            importance: 5,
                            kind: 'constraint',
                        },
                    ],
                },
                { embeddingProvider: new ThrowingEmbeddingProvider() },
            )

            expect(result.accepted).toBe(true)
            const memoryId = result.memoryIds?.[0]
            if (!memoryId) {
                throw new Error('expected memory id')
            }
            expect(await rowsForObservation(memoryId)).toHaveLength(1)
            expect(await embeddingRowsFor('memory')).toHaveLength(0)
        })
    })
})

describe('save diary embeddings', () => {
    it('embeds a newly saved diary retrieval document', async () => {
        const projectRoot = await makeInitializedProject()

        await withProjectRoot(projectRoot, async () => {
            const context = await loadProjectContext()
            const result = await saveKonteksDiary(
                context,
                {
                    subject: 'save diary embedding',
                    summary:
                        'Saved diary entries should be immediately available through semantic retrieval.',
                    tags: ['embedding'],
                },
                { embeddingProvider: new FakeEmbeddingProvider() },
            )

            const diaryId = result.diaryId
            if (!diaryId) {
                throw new Error('expected diary id')
            }
            await expectTargetIndexed(diaryId, 'diary')
        })
    })

    it('keeps diary save successful when embedding fails', async () => {
        const projectRoot = await makeInitializedProject()

        await withProjectRoot(projectRoot, async () => {
            const context = await loadProjectContext()
            const result = await saveKonteksDiary(
                context,
                {
                    subject: 'embedding failure',
                    summary:
                        'Diary persistence should survive an embedding provider failure.',
                },
                { embeddingProvider: new ThrowingEmbeddingProvider() },
            )

            expect(result.accepted).toBe(true)
            const diaryId = result.diaryId
            if (!diaryId) {
                throw new Error('expected diary id')
            }
            expect(await rowsForDiary(diaryId)).toHaveLength(1)
            expect(await embeddingRowsFor('diary')).toHaveLength(0)
        })
    })
})

async function makeInitializedProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-save-embed-'))
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

async function expectTargetIndexed(
    targetId: string,
    targetType: 'diary' | 'memory',
): Promise<void> {
    const retrievalRows = await retrievalRowsFor(targetId, targetType)
    const embeddingRows = await embeddingRowsFor(targetType)

    expect(retrievalRows).toHaveLength(1)
    expect(embeddingRows).toHaveLength(1)
    expect(embeddingRows[0]).toMatchObject({
        model: 'fake/all-MiniLM-L6-v2',
        targetId,
        targetType,
    })
}

async function retrievalRowsFor(
    targetId: string,
    targetType: 'diary' | 'memory',
) {
    const db = await getDb()
    return await db
        .select()
        .from(retrievalDocuments)
        .where(eq(retrievalDocuments.targetId, targetId))
        .then(rows => rows.filter(row => row.targetType === targetType))
}

async function embeddingRowsFor(targetType: 'diary' | 'memory') {
    const db = await getDb()
    return await db
        .select()
        .from(targetEmbeddings)
        .where(eq(targetEmbeddings.targetType, targetType))
}

async function rowsForObservation(id: string) {
    const db = await getDb()
    return await db.select().from(observations).where(eq(observations.id, id))
}

async function rowsForDiary(id: string) {
    const db = await getDb()
    return await db.select().from(diaryEntries).where(eq(diaryEntries.id, id))
}

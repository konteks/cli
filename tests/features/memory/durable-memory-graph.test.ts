import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import traverseNeighbors from '@/database/actions/traverse-neighbors'
import forgetMemory from '@/database/services/forget-memory'
import { entityIdFor } from '@/database/services/graph'
import {
    saveKonteksDiary,
    saveKonteksMemories,
} from '@/database/services/save-memory'
import { extractProject } from '@/modules/extraction/extract-project'
import recallRepositoryMemory from '@/modules/memory/recall-repository-memory'
import { loadProjectContext } from '@/modules/project/context'
import FakeEmbeddingProvider from '../../fake/fake-embedding-provider'

const tempDirs: string[] = []
const originalCwd = process.cwd()

afterEach(async () => {
    process.chdir(originalCwd)
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('durable memory graph projection', () => {
    it('projects constraint memories to source graph entities and recall evidence', async () => {
        const projectRoot = await makeExtractedProject()
        process.chdir(projectRoot)
        const context = await loadProjectContext()

        const result = await saveKonteksMemories(
            context,
            {
                memories: [
                    {
                        content:
                            'Cycle five durable policy requires graph evidence to stay attached to src/durable-policy.txt during recall.',
                        importance: 5,
                        kind: 'constraint',
                        source: 'src/durable-policy.txt',
                        tags: ['durable-policy'],
                    },
                ],
            },
            { embeddingProvider: new FakeEmbeddingProvider() },
        )

        const memoryId = result.memoryIds?.[0]
        if (!memoryId) {
            throw new Error('expected memory id')
        }

        const neighbors = await traverseNeighbors(
            entityIdFor('memory', memoryId),
        )
        expect(neighbors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entity: expect.objectContaining({
                        name: 'durable-policy.txt',
                        type: 'file',
                    }),
                    predicate: 'applies_to',
                }),
            ]),
        )

        const recall = await recallRepositoryMemory({
            task: 'cycle five durable policy graph evidence',
        })
        expect(recall.graph).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityName: 'durable-policy.txt',
                    predicate: 'applies_to',
                    relatedEntityName: expect.stringContaining(memoryId),
                }),
            ]),
        )
    })

    it('projects code insight and diary mentions with idempotent relation writes', async () => {
        const projectRoot = await makeExtractedProject()
        process.chdir(projectRoot)
        const context = await loadProjectContext()
        const memoryInput = {
            memories: [
                {
                    content:
                        'The `durable-policy.txt` implementation documents cycle five durable graph behavior.',
                    importance: 4 as const,
                    kind: 'code_insight' as const,
                },
            ],
        }

        const first = await saveKonteksMemories(context, memoryInput, {
            embeddingProvider: new FakeEmbeddingProvider(),
        })
        const second = await saveKonteksMemories(context, memoryInput, {
            embeddingProvider: new FakeEmbeddingProvider(),
        })
        const diary = await saveKonteksDiary(
            context,
            {
                subject: 'durable graph diary',
                summary:
                    'Diary summary mentions `src/durable-policy.txt` as the durable graph recall fixture.',
                tags: ['durable-policy'],
            },
            { embeddingProvider: new FakeEmbeddingProvider() },
        )

        const memoryId = first.memoryIds?.[0]
        if (!memoryId || !diary.diaryId) {
            throw new Error('expected durable ids')
        }

        expect(second.memoryIds).toEqual(first.memoryIds)
        await expect(
            traverseNeighbors(entityIdFor('memory', memoryId)),
        ).resolves.toEqual([
            expect.objectContaining({
                entity: expect.objectContaining({
                    name: 'durable-policy.txt',
                    type: 'file',
                }),
                predicate: 'concerns',
            }),
        ])
        await expect(
            traverseNeighbors(entityIdFor('diary', diary.diaryId)),
        ).resolves.toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entity: expect.objectContaining({
                        name: 'durable-policy.txt',
                        type: 'file',
                    }),
                    predicate: 'concerns',
                }),
            ]),
        )
    })

    it('removes durable graph rows when memory is forgotten', async () => {
        const projectRoot = await makeExtractedProject()
        process.chdir(projectRoot)
        const context = await loadProjectContext()
        const result = await saveKonteksMemories(
            context,
            {
                memories: [
                    {
                        content:
                            'Forget cleanup should remove graph evidence attached to src/durable-policy.txt.',
                        importance: 3,
                        kind: 'note',
                        source: 'src/durable-policy.txt',
                    },
                ],
            },
            { embeddingProvider: new FakeEmbeddingProvider() },
        )
        const memoryId = result.memoryIds?.[0]
        if (!memoryId) {
            throw new Error('expected memory id')
        }

        await expect(
            traverseNeighbors(entityIdFor('memory', memoryId)),
        ).resolves.not.toEqual([])

        await forgetMemory({
            id: memoryId,
            mode: 'soft_delete',
            reason: 'durable graph cleanup test',
        })

        await expect(
            traverseNeighbors(entityIdFor('memory', memoryId)),
        ).resolves.toEqual([])
    })
})

async function makeExtractedProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-durable-graph-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    await writeFile(
        join(projectRoot, 'src', 'durable-policy.txt'),
        'Durable policy fixture for graph projection.\n',
    )

    const previous = process.cwd()
    process.chdir(projectRoot)
    try {
        const context = await loadProjectContext()
        await extractProject(context, 'rebuild', {
            embeddingProvider: new FakeEmbeddingProvider(),
        })
    } finally {
        process.chdir(previous)
    }

    return projectRoot
}

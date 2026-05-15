import { describe, expect, it } from 'bun:test'
import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import { recallRepositoryMemory } from '@/memory/recall'
import type {
    MemoryEntity,
    MemorySearchResult,
    RecallHistoryItem,
} from '@/models/memory'

function memory(input: Partial<MemorySearchResult>): MemorySearchResult {
    return {
        createdAt: '2026-01-01T00:00:00.000Z',
        excerpt: 'Remember the SQLite implementation path.',
        id: 'obs_1',
        path: 'src/a.ts',
        score: 100,
        type: 'memory',
        ...input,
    }
}

function entity(input: Partial<MemoryEntity> & { id: string }): MemoryEntity {
    return {
        canonicalName: input.name ?? input.id,
        id: input.id,
        name: input.name ?? input.id,
        type: input.type ?? 'module',
    }
}

describe('memory/recall', () => {
    it('deduplicates memories, compacts sources, and reports partial quality', () => {
        const first = memory({ id: 'obs_1', score: 120 })
        const duplicate = memory({ id: 'obs_1', score: 110 })
        const second = memory({
            excerpt: 'Inspect the recall package assembly.',
            id: 'chunk_1',
            path: 'src/b.ts',
            score: 90,
            type: 'chunk',
        })

        const result = recallRepositoryMemory(
            memoryRepository({ memories: [first, duplicate, second] }),
            { task: 'continue recall work' },
        )

        return expect(result).resolves.toMatchObject({
            brief: expect.arrayContaining(['Quality: partial.']),
            primaryTargets: ['src/a.ts', 'src/b.ts'],
            quality: 'partial',
            sourceCount: 2,
        })
    })

    it('keeps source detail when requested and preserves full graph/history evidence', () => {
        const result = recallRepositoryMemory(
            memoryRepository({
                entities: [entity({ id: 'project', name: 'Project' })],
                histories: Array.from({ length: 6 }, (_, index) => ({
                    object: entity({
                        id: `o${index}`,
                        name: `Object ${index}`,
                    }),
                    predicate: 'replaced',
                    relationId: `hist_${index}`,
                    status: 'invalidated' as const,
                    subject: entity({
                        id: `s${index}`,
                        name: `Subject ${index}`,
                    }),
                })),
                memories: [memory({ metadata: { tokenCost: 10 }, score: 220 })],
                neighbors: Array.from({ length: 8 }, (_, index) => ({
                    depth: 1,
                    direction: 'outgoing' as const,
                    entity: entity({
                        id: `r${index}`,
                        name: `Related ${index}`,
                    }),
                    predicate: 'uses',
                    relationId: `rel_${index}`,
                })),
            }),
            { includeSources: true, task: 'why changed' },
        )

        return result.then(recall => {
            expect(recall.graph).toHaveLength(8)
            expect(recall.history).toHaveLength(6)
            expect(recall.memories[0]?.metadata).toEqual({ tokenCost: 10 })
        })
    })

    it('searches memories, graph neighbors, and historical relations through the repository', async () => {
        const root = entity({ id: 'project', name: 'Konteks', type: 'project' })
        const related = entity({ id: 'runtime', name: 'Bun', type: 'runtime' })
        const history: RecallHistoryItem = {
            objectEntityId: 'old',
            objectEntityName: 'Node',
            predicate: 'replaced',
            reason: 'Included because task asks for historical or superseded context.',
            relationId: 'hist_1',
            status: 'superseded',
            subjectEntityId: 'project',
            subjectEntityName: 'Konteks',
        }
        const repository = memoryRepository({
            entities: [root, root],
            histories: [
                {
                    object: entity({ id: 'old', name: 'Node' }),
                    predicate: 'replaced',
                    relationId: history.relationId,
                    status: history.status,
                    subject: root,
                },
            ],
            memories: [memory({ id: 'obs_1', score: 100 })],
            neighbors: [
                {
                    depth: 1,
                    direction: 'outgoing' as const,
                    entity: related,
                    predicate: 'uses',
                    relationId: 'rel_1',
                },
            ],
        })

        const recall = await recallRepositoryMemory(repository, {
            task: 'why did runtime change',
        })

        expect(recall.memories.map(item => item.id)).toEqual(['obs_1'])
        expect(recall.graph).toEqual([
            expect.objectContaining({
                entityName: 'Konteks',
                predicate: 'uses',
                relatedEntityName: 'Bun',
            }),
        ])
        expect(recall.history).toEqual([expect.objectContaining(history)])
    })
})

function memoryRepository(input: {
    entities?: MemoryEntity[]
    histories?: Awaited<
        ReturnType<MemoryRepositoryContract['historicalRelations']>
    >
    memories?: MemorySearchResult[]
    neighbors?: Awaited<
        ReturnType<MemoryRepositoryContract['traverseNeighbors']>
    >
}): MemoryRepositoryContract {
    return {
        async historicalRelations() {
            return input.histories ?? []
        },
        async search() {
            return input.memories ?? []
        },
        async searchEntities() {
            return input.entities ?? []
        },
        async traverseNeighbors() {
            return input.neighbors ?? []
        },
    } as unknown as MemoryRepositoryContract
}

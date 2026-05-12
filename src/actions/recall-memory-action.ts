import { assembleRecallPackage } from '@/actions/recall-package'
import type {
    MemoryRecallInput,
    MemoryRepositoryContract,
} from '@/contracts/repositories/memory-repository'
import type {
    MemoryEntity,
    RecallGraphItem,
    RecallHistoryItem,
    RecallPackage,
} from '@/models/memory'

export class RecallMemoryAction {
    constructor(private readonly memoryRepository: MemoryRepositoryContract) {}

    async execute(input: MemoryRecallInput): Promise<RecallPackage> {
        const memories = await this.memoryRepository.search({
            limit: 20,
            query: input.task,
        })
        const rawEntities = await this.memoryRepository.searchEntities(
            input.task,
            4,
        )
        const entities = dedupeEntities(rawEntities)

        const graphItems: RecallGraphItem[] = []
        const historyItems: RecallHistoryItem[] = []

        if (needsHistory(input.task)) {
            const seenRelations = new Set<string>()
            for (const entity of entities) {
                const relations =
                    await this.memoryRepository.historicalRelations(
                        entity.id,
                        6,
                    )
                for (const relation of relations) {
                    if (seenRelations.has(relation.relationId)) continue
                    seenRelations.add(relation.relationId)

                    historyItems.push({
                        objectEntityId: relation.object.id,
                        objectEntityName: relation.object.name,
                        predicate: relation.predicate,
                        reason: `Included because task asks for historical or superseded context.`,
                        relationId: relation.relationId,
                        status: relation.status,
                        subjectEntityId: relation.subject.id,
                        subjectEntityName: relation.subject.name,
                        validFrom: relation.validFrom,
                        validTo: relation.validTo,
                    })
                }
            }
        }

        const seenNeighbors = new Set<string>()
        for (const entity of entities) {
            const neighbors = await this.memoryRepository.traverseNeighbors(
                entity.id,
                { limit: 8, maxDepth: 2 },
            )
            for (const neighbor of neighbors) {
                if (seenNeighbors.has(neighbor.relationId)) continue
                seenNeighbors.add(neighbor.relationId)

                graphItems.push({
                    depth: neighbor.depth,
                    direction: neighbor.direction,
                    entityId: entity.id,
                    entityName: entity.name,
                    entityType: entity.type,
                    predicate: neighbor.predicate,
                    relatedEntityId: neighbor.entity.id,
                    relatedEntityName: neighbor.entity.name,
                    relatedEntityType: neighbor.entity.type,
                    relationId: neighbor.relationId,
                    score: Math.max(1, 10 - neighbor.depth * 2),
                })
            }
        }

        return assembleRecallPackage({
            graph: graphItems,
            history: historyItems,
            includeSources: input.includeSources ?? false,
            maxTokens: input.maxTokens ?? 2000,
            memories,
            task: input.task,
        })
    }
}

function needsHistory(task: string): boolean {
    return /\b(history|historical|previous|prior|old|before|changed|why|superseded|invalidated|replaced|migration|attempt|rollback|decision)\b/iu.test(
        task,
    )
}

function dedupeEntities(entities: MemoryEntity[]): MemoryEntity[] {
    const seen = new Set<string>()
    return entities.filter(e => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
    })
}

import type { GraphPathStep } from '@/database/services/graph'
import queryPathRows, { type PathRow } from './query-path-rows'

export default async function findPath(
    fromEntityId: string,
    toEntityId: string,
    maxDepth = 3,
): Promise<GraphPathStep[]> {
    const rows = await queryPathRows(
        fromEntityId,
        toEntityId,
        clampDepth(maxDepth),
    )
    return rows[0] ? toPathSteps(rows[0]) : []
}

function clampDepth(depth: number): number {
    return Math.max(1, Math.min(Math.trunc(depth), 5))
}

function toPathSteps(row: PathRow): GraphPathStep[] {
    const entities = row.entity_path.split(',')
    const relations = row.relation_path.split(',').filter(Boolean)
    const predicates = row.predicate_path.split(',').filter(Boolean)

    return relations.map((relationId, index) => ({
        depth: index + 1,
        fromEntityId: entities[index] ?? '',
        predicate: predicates[index] ?? '',
        relationId,
        toEntityId: entities[index + 1] ?? '',
    }))
}

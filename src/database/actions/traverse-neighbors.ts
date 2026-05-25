import type EntityRecord from './_types/entity-record'
import type { EntityRow } from './query-entity-search-rows'
import queryNeighborRows from './query-neighbor-rows'

export type TraversedNeighbor = {
    depth: number
    relationId: string
    predicate: string
    direction: 'incoming' | 'outgoing'
    entity: EntityRecord
    originId: string
}

export default async function traverseNeighbors(
    entityId: string,
    options: { maxDepth?: number; limit?: number } = {},
): Promise<Omit<TraversedNeighbor, 'originId'>[]> {
    const neighbors = await traverseNeighborsForEntities([entityId], options)
    return neighbors.map(({ originId: _originId, ...neighbor }) => neighbor)
}

export async function traverseNeighborsForEntities(
    entityIds: string[],
    options: { maxDepth?: number; limit?: number } = {},
): Promise<TraversedNeighbor[]> {
    const rows = await queryNeighborRows(
        entityIds,
        clampDepth(options.maxDepth ?? 1),
        options.limit ?? 25,
    )

    return rows.map(row => ({
        depth: row.depth,
        direction: row.direction,
        entity: entityFromRow(row),
        originId: row.origin_id,
        predicate: row.predicate,
        relationId: row.relation_id,
    }))
}

function entityFromRow(row: EntityRow): EntityRecord {
    return {
        canonicalName: row.canonical_name,
        id: row.id,
        name: row.name,
        summary: row.summary ?? undefined,
        type: row.type,
    }
}

function clampDepth(depth: number): number {
    return Math.max(1, Math.min(Math.trunc(depth), 5))
}

import type { EntityRecord, GraphNeighbor } from '@/database/services/graph'
import type { EntityRow } from './query-entity-search-rows'
import queryNeighborRows from './query-neighbor-rows'

export default async function traverseNeighbors(
    entityId: string,
    options: { maxDepth?: number; limit?: number } = {},
): Promise<GraphNeighbor[]> {
    const rows = await queryNeighborRows(
        entityId,
        clampDepth(options.maxDepth ?? 1),
        options.limit ?? 25,
    )

    return rows.map(row => ({
        depth: row.depth,
        direction: row.direction,
        entity: entityFromRow(row),
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

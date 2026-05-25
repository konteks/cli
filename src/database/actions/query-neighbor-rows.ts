import { sql } from 'drizzle-orm'
import getDb from './_db'
import type { EntityRow } from './query-entity-search-rows'

export type NeighborRow = EntityRow & {
    depth: number
    relation_id: string
    predicate: string
    direction: 'incoming' | 'outgoing'
    origin_id: string
}

export default async function queryNeighborRows(
    entityId: string | string[],
    maxDepth: number,
    limit: number,
): Promise<NeighborRow[]> {
    const entityIds = Array.isArray(entityId) ? entityId : [entityId]
    if (entityIds.length === 0) {
        return []
    }

    const db = await getDb()
    const originValues = sql.join(
        entityIds.map((id, index) => sql`(${id}, ${index})`),
        sql`, `,
    )
    return await db.all<NeighborRow>(sql`
with recursive
origins(origin_id, origin_order) as (
    values ${originValues}
),
walk(origin_id, origin_order, depth, entity_id, relation_id, predicate, direction, visited) as (
    select origins.origin_id, origins.origin_order, 1, r.object_id, r.id, r.predicate, 'outgoing', origins.origin_id || ',' || r.object_id
    from origins
    join relations r on r.subject_id = origins.origin_id and r.status = 'active'
    union all
    select origins.origin_id, origins.origin_order, 1, r.subject_id, r.id, r.predicate, 'incoming', origins.origin_id || ',' || r.subject_id
    from origins
    join relations r on r.object_id = origins.origin_id and r.status = 'active'
    union all
    select walk.origin_id, walk.origin_order, walk.depth + 1, r.object_id, r.id, r.predicate, 'outgoing', walk.visited || ',' || r.object_id
    from walk
    join relations r on r.subject_id = walk.entity_id and r.status = 'active'
    where walk.depth < ${maxDepth} and instr(walk.visited, r.object_id) = 0
    union all
    select walk.origin_id, walk.origin_order, walk.depth + 1, r.subject_id, r.id, r.predicate, 'incoming', walk.visited || ',' || r.subject_id
    from walk
    join relations r on r.object_id = walk.entity_id and r.status = 'active'
    where walk.depth < ${maxDepth} and instr(walk.visited, r.subject_id) = 0
),
ranked as (
    select walk.origin_id, walk.origin_order, walk.depth, walk.relation_id, walk.predicate, walk.direction,
           e.id, e.type, e.name, e.canonical_name, e.summary,
           row_number() over (
               partition by walk.origin_id
               order by walk.depth, e.name
           ) as result_rank
    from walk
    join entities e on e.id = walk.entity_id
)
select origin_id, depth, relation_id, predicate, direction,
       e.id, e.type, e.name, e.canonical_name, e.summary
from ranked e
where result_rank <= ${limit}
order by origin_order, depth, name
`)
}

import { sql } from 'drizzle-orm'
import getDb from './_db'
import type { EntityRow } from './query-entity-search-rows'

export type NeighborRow = EntityRow & {
    depth: number
    relation_id: string
    predicate: string
    direction: 'incoming' | 'outgoing'
}

export default async function queryNeighborRows(
    entityId: string,
    maxDepth: number,
    limit: number,
): Promise<NeighborRow[]> {
    const db = await getDb()
    return await db.all<NeighborRow>(sql`
with recursive walk(depth, entity_id, relation_id, predicate, direction, visited) as (
    select 1, r.object_id, r.id, r.predicate, 'outgoing', ${entityId} || ',' || r.object_id
    from relations r
    where r.subject_id = ${entityId} and r.status = 'active'
    union all
    select 1, r.subject_id, r.id, r.predicate, 'incoming', ${entityId} || ',' || r.subject_id
    from relations r
    where r.object_id = ${entityId} and r.status = 'active'
    union all
    select walk.depth + 1, r.object_id, r.id, r.predicate, 'outgoing', walk.visited || ',' || r.object_id
    from walk
    join relations r on r.subject_id = walk.entity_id and r.status = 'active'
    where walk.depth < ${maxDepth} and instr(walk.visited, r.object_id) = 0
    union all
    select walk.depth + 1, r.subject_id, r.id, r.predicate, 'incoming', walk.visited || ',' || r.subject_id
    from walk
    join relations r on r.object_id = walk.entity_id and r.status = 'active'
    where walk.depth < ${maxDepth} and instr(walk.visited, r.subject_id) = 0
)
select walk.depth, walk.relation_id, walk.predicate, walk.direction,
       e.id, e.type, e.name, e.canonical_name, e.summary
from walk
join entities e on e.id = walk.entity_id
order by walk.depth, e.name
limit ${limit}
`)
}

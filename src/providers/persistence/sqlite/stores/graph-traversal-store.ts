import { querySql, type SqliteExecutor } from '../libsql-helpers'
import { entityFromHistoricalRow, entityFromRow } from './graph-row-mappers'
import type {
    GraphNeighbor,
    HistoricalRelation,
    HistoricalRelationRow,
    NeighborRow,
} from './graph-types'
import {
    clampDepth,
    type GraphPathStep,
    type PathRow,
    toPathSteps,
} from './graph-utils'

export default class GraphTraversalStore {
    public constructor(private readonly client: SqliteExecutor) {}

    public async traverseNeighbors(
        entityId: string,
        options: { maxDepth?: number; limit?: number } = {},
    ): Promise<GraphNeighbor[]> {
        const maxDepth = clampDepth(options.maxDepth ?? 1)
        const limit = options.limit ?? 25
        const rows = await querySql<NeighborRow>(
            this.client,
            `
with recursive walk(depth, entity_id, relation_id, predicate, direction, visited) as (
    select
        1,
        r.object_id,
        r.id,
        r.predicate,
        'outgoing',
        ? || ',' || r.object_id
    from relations r
    where r.subject_id = ? and r.status = 'active'

    union all

    select
        1,
        r.subject_id,
        r.id,
        r.predicate,
        'incoming',
        ? || ',' || r.subject_id
    from relations r
    where r.object_id = ? and r.status = 'active'

    union all

    select
        walk.depth + 1,
        r.object_id,
        r.id,
        r.predicate,
        'outgoing',
        walk.visited || ',' || r.object_id
    from walk
    join relations r on r.subject_id = walk.entity_id and r.status = 'active'
    where walk.depth < ? and instr(walk.visited, r.object_id) = 0

    union all

    select
        walk.depth + 1,
        r.subject_id,
        r.id,
        r.predicate,
        'incoming',
        walk.visited || ',' || r.subject_id
    from walk
    join relations r on r.object_id = walk.entity_id and r.status = 'active'
    where walk.depth < ? and instr(walk.visited, r.subject_id) = 0
)
select
    walk.depth,
    walk.relation_id,
    walk.predicate,
    walk.direction,
    e.id,
    e.type,
    e.name,
    e.canonical_name,
    e.summary
from walk
join entities e on e.id = walk.entity_id
order by walk.depth, e.name
limit ?
`,
            [entityId, entityId, entityId, entityId, maxDepth, maxDepth, limit],
        )

        return rows.map(row => ({
            depth: row.depth,
            direction: row.direction,
            entity: entityFromRow(row),
            predicate: row.predicate,
            relationId: row.relation_id,
        }))
    }

    public async historicalRelations(
        entityId: string,
        options: { limit?: number } = {},
    ): Promise<HistoricalRelation[]> {
        const rows = await querySql<HistoricalRelationRow>(
            this.client,
            `
select
    r.id as relation_id,
    r.predicate,
    r.status,
    r.valid_from,
    r.valid_to,
    s.id as subject_id,
    s.type as subject_type,
    s.name as subject_name,
    s.canonical_name as subject_canonical_name,
    s.summary as subject_summary,
    o.id as object_id,
    o.type as object_type,
    o.name as object_name,
    o.canonical_name as object_canonical_name,
    o.summary as object_summary
from relations r
join entities s on s.id = r.subject_id
join entities o on o.id = r.object_id
where (r.subject_id = ? or r.object_id = ?)
  and r.status in ('invalidated', 'superseded')
order by r.updated_at desc
limit ?
`,
            [entityId, entityId, options.limit ?? 10],
        )

        return rows.map(row => ({
            object: entityFromHistoricalRow(row, 'object'),
            predicate: row.predicate,
            relationId: row.relation_id,
            status: row.status,
            subject: entityFromHistoricalRow(row, 'subject'),
            validFrom: row.valid_from ?? undefined,
            validTo: row.valid_to ?? undefined,
        }))
    }

    public async findPath(
        fromEntityId: string,
        toEntityId: string,
        maxDepth = 3,
    ): Promise<GraphPathStep[]> {
        const rows = await querySql<PathRow>(
            this.client,
            `
with recursive path(depth, entity_id, entity_path, relation_path, predicate_path) as (
    select
        0,
        ?,
        ?,
        '',
        ''

    union all

    select
        path.depth + 1,
        r.object_id,
        path.entity_path || ',' || r.object_id,
        case when path.relation_path = '' then r.id else path.relation_path || ',' || r.id end,
        case when path.predicate_path = '' then r.predicate else path.predicate_path || ',' || r.predicate end
    from path
    join relations r on r.subject_id = path.entity_id and r.status = 'active'
    where path.depth < ? and instr(path.entity_path, r.object_id) = 0
)
select entity_path, relation_path, predicate_path
from path
where entity_id = ? and depth > 0
order by depth
limit 1
`,
            [fromEntityId, fromEntityId, clampDepth(maxDepth), toEntityId],
        )
        const row = rows[0]
        if (!row) {
            return []
        }

        return toPathSteps(row)
    }
}

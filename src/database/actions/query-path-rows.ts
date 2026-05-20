import { sql } from 'drizzle-orm'
import db from './_db'

export type PathRow = {
    relation_path: string
    entity_path: string
    predicate_path: string
}

export default async function queryPathRows(
    fromEntityId: string,
    toEntityId: string,
    maxDepth: number,
): Promise<PathRow[]> {
    return await db.all<PathRow>(sql`
with recursive path(depth, entity_id, entity_path, relation_path, predicate_path) as (
    select 0, ${fromEntityId}, ${fromEntityId}, '', ''
    union all
    select path.depth + 1, r.object_id, path.entity_path || ',' || r.object_id,
           case when path.relation_path = '' then r.id else path.relation_path || ',' || r.id end,
           case when path.predicate_path = '' then r.predicate else path.predicate_path || ',' || r.predicate end
    from path
    join relations r on r.subject_id = path.entity_id and r.status = 'active'
    where path.depth < ${maxDepth} and instr(path.entity_path, r.object_id) = 0
)
select entity_path, relation_path, predicate_path
from path
where entity_id = ${toEntityId} and depth > 0
order by depth
limit 1
`)
}

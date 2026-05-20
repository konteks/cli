import { sql } from 'drizzle-orm'
import getDb from './_db'

export type HistoricalRelationRow = {
    relation_id: string
    predicate: string
    status: 'invalidated' | 'superseded'
    valid_from: string | null
    valid_to: string | null
    subject_id: string
    subject_type: string
    subject_name: string
    subject_canonical_name: string
    subject_summary: string | null
    object_id: string
    object_type: string
    object_name: string
    object_canonical_name: string
    object_summary: string | null
}

export default async function queryHistoricalRelationRows(
    entityId: string,
    limit: number,
): Promise<HistoricalRelationRow[]> {
    const db = await getDb()
    return await db.all<HistoricalRelationRow>(sql`
select
    r.id as relation_id, r.predicate, r.status, r.valid_from, r.valid_to,
    s.id as subject_id, s.type as subject_type, s.name as subject_name,
    s.canonical_name as subject_canonical_name, s.summary as subject_summary,
    o.id as object_id, o.type as object_type, o.name as object_name,
    o.canonical_name as object_canonical_name, o.summary as object_summary
from relations r
join entities s on s.id = r.subject_id
join entities o on o.id = r.object_id
where (r.subject_id = ${entityId} or r.object_id = ${entityId})
  and r.status in ('invalidated', 'superseded')
order by r.updated_at desc
limit ${limit}
`)
}

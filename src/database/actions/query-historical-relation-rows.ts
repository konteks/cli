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
    entityId: string | string[],
    limit: number,
): Promise<HistoricalRelationRow[]> {
    const entityIds = Array.isArray(entityId) ? entityId : [entityId]
    if (entityIds.length === 0) {
        return []
    }

    const db = await getDb()
    const originValues = sql.join(
        entityIds.map(entityId => sql`(${entityId})`),
        sql`, `,
    )
    return await db.all<HistoricalRelationRow>(sql`
with origins(entity_id) as (
    values ${originValues}
),
matched as (
select
    origins.entity_id as origin_id,
    r.id as relation_id, r.predicate, r.status, r.valid_from, r.valid_to,
    s.id as subject_id, s.type as subject_type, s.name as subject_name,
    s.canonical_name as subject_canonical_name, s.summary as subject_summary,
    o.id as object_id, o.type as object_type, o.name as object_name,
    o.canonical_name as object_canonical_name, o.summary as object_summary,
    row_number() over (
        partition by origins.entity_id
        order by r.updated_at desc
    ) as result_rank
from origins
join relations r
  on (r.subject_id = origins.entity_id or r.object_id = origins.entity_id)
 and r.status in ('invalidated', 'superseded')
join entities s on s.id = r.subject_id
join entities o on o.id = r.object_id
)
select
    relation_id, predicate, status, valid_from, valid_to,
    subject_id, subject_type, subject_name, subject_canonical_name, subject_summary,
    object_id, object_type, object_name, object_canonical_name, object_summary
from matched
where result_rank <= ${limit}
order by valid_to desc, valid_from desc
`)
}

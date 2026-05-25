import { sql } from 'drizzle-orm'
import getDb from './_db'

export type EntityRow = {
    id: string
    type: string
    name: string
    canonical_name: string
    summary: string | null
}

export type EntitySearchRow = EntityRow & {
    score: number
}

export default async function queryEntitySearchRows(
    terms: string[],
    limit: number,
): Promise<EntitySearchRow[]> {
    const db = await getDb()
    return await db.all<EntitySearchRow>(sql`
with alias_scores as (
    select
        a.entity_id,
        3 as score
    from entity_aliases a
    where ${sql.join(
        terms.map(term => sql`a.normalized_value like ${`%${term}%`}`),
        sql` or `,
    )}
    group by a.entity_id
),
scored_entities as (
select
    e.id,
    e.type,
    e.name,
    e.canonical_name,
    e.summary,
    (
        case when lower(e.name) in (${sql.join(
            terms.map(term => sql`${term}`),
            sql`, `,
        )}) then 4 else 0 end
        + case when ${sql.join(
            terms.map(term => sql`lower(e.name) like ${`%${term}%`}`),
            sql` or `,
        )} then 3 else 0 end
        + case when ${sql.join(
            terms.map(
                term => sql`lower(coalesce(e.summary, '')) like ${`%${term}%`}`,
            ),
            sql` or `,
        )} then 1 else 0 end
        + coalesce(a.score, 0)
    ) as score
from entities e
left join alias_scores a on a.entity_id = e.id
)
select *
from scored_entities
where score > 0
order by score desc
limit ${limit}
`)
}

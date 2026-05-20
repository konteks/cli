import { sql } from 'drizzle-orm'
import db from './_db'

export type TaxonomyPathRow = {
    id_path: string
    name_path: string
}

export default async function queryTaxonomyPathRows(
    nodeId: string,
): Promise<TaxonomyPathRow[]> {
    return await db.all<TaxonomyPathRow>(sql`
with recursive ancestors(id, parent_id, id_path, name_path) as (
    select id, parent_id, id, name
    from taxonomy_nodes
    where id = ${nodeId}
    union all
    select n.id, n.parent_id, n.id || '>' || ancestors.id_path, n.name || '>' || ancestors.name_path
    from taxonomy_nodes n
    join ancestors on ancestors.parent_id = n.id
)
select id_path, name_path
from ancestors
where parent_id is null
limit 1
`)
}

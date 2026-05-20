import { sql } from 'drizzle-orm'
import getDb from './_db'

export type TaxonomyNodeRow = {
    id: string
    parent_id: string | null
    name: string
    summary: string | null
}

export type TaxonomyTreeRow = TaxonomyNodeRow & {
    depth: number
}

export default async function queryTaxonomySubtreeRows(
    rootId: string | undefined,
    maxDepth: number,
): Promise<TaxonomyTreeRow[]> {
    const db = await getDb()
    return await db.all<TaxonomyTreeRow>(
        rootId
            ? sql`
with recursive tree(depth, id, parent_id, name, summary) as (
    select 0, id, parent_id, name, summary
    from taxonomy_nodes
    where id = ${rootId}
    union all
    select tree.depth + 1, n.id, n.parent_id, n.name, n.summary
    from taxonomy_nodes n
    join tree on n.parent_id = tree.id
    where tree.depth < ${maxDepth}
)
select depth, id, parent_id, name, summary
from tree
order by depth, name
`
            : sql`
with recursive tree(depth, id, parent_id, name, summary) as (
    select 0, id, parent_id, name, summary
    from taxonomy_nodes
    where parent_id is null
    union all
    select tree.depth + 1, n.id, n.parent_id, n.name, n.summary
    from taxonomy_nodes n
    join tree on n.parent_id = tree.id
    where tree.depth < ${maxDepth}
)
select depth, id, parent_id, name, summary
from tree
order by depth, name
`,
    )
}

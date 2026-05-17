import type { SqliteAdapter } from '../sqlite-adapter'
import { taxonomyNodeFromRow } from './taxonomy-row-mappers'
import type {
    TaxonomyNode,
    TaxonomyPathRow,
    TaxonomyTreeNode,
    TaxonomyTreeRow,
} from './taxonomy-types'

export default class TaxonomyTreeStore {
    public constructor(private readonly adapter: SqliteAdapter) {}

    public async getSubtree(
        rootId?: string,
        options: { maxDepth?: number } = {},
    ): Promise<TaxonomyTreeNode[]> {
        const maxDepth = clampDepth(options.maxDepth ?? 4)
        const rows = await this.adapter.query<TaxonomyTreeRow>(
            rootId
                ? `
with recursive tree(depth, id, parent_id, name, summary) as (
    select 0, id, parent_id, name, summary
    from taxonomy_nodes
    where id = ?

    union all

    select tree.depth + 1, n.id, n.parent_id, n.name, n.summary
    from taxonomy_nodes n
    join tree on n.parent_id = tree.id
    where tree.depth < ?
)
select depth, id, parent_id, name, summary
from tree
order by depth, name
`
                : `
with recursive tree(depth, id, parent_id, name, summary) as (
    select 0, id, parent_id, name, summary
    from taxonomy_nodes
    where parent_id is null

    union all

    select tree.depth + 1, n.id, n.parent_id, n.name, n.summary
    from taxonomy_nodes n
    join tree on n.parent_id = tree.id
    where tree.depth < ?
)
select depth, id, parent_id, name, summary
from tree
order by depth, name
`,
            rootId ? [rootId, maxDepth] : [maxDepth],
        )

        return rows.map(row => ({
            ...taxonomyNodeFromRow(row),
            depth: row.depth,
        }))
    }

    public async getPath(nodeId: string): Promise<TaxonomyNode[]> {
        const rows = await this.adapter.query<TaxonomyPathRow>(
            `
with recursive ancestors(id, parent_id, id_path, name_path) as (
    select id, parent_id, id, name
    from taxonomy_nodes
    where id = ?

    union all

    select n.id, n.parent_id, n.id || '>' || ancestors.id_path, n.name || '>' || ancestors.name_path
    from taxonomy_nodes n
    join ancestors on ancestors.parent_id = n.id
)
select id_path, name_path
from ancestors
where parent_id is null
limit 1
`,
            [nodeId],
        )
        const row = rows[0]
        if (!row) {
            return []
        }

        const ids = row.id_path.split('>')
        const names = row.name_path.split('>')
        return ids.map((id, index) => ({
            id,
            name: names[index] ?? '',
        }))
    }
}

function clampDepth(depth: number): number {
    return Math.max(0, Math.min(Math.trunc(depth), 8))
}

import { randomUUID } from 'node:crypto'
import type { SqliteAdapter } from '../sqlite-adapter'

type TaxonomyNodeInput = {
    parentId?: string
    name: string
    summary?: string
}

type TaxonomyNode = {
    id: string
    parentId?: string
    name: string
    summary?: string
}

type TaxonomyLinkInput = {
    nodeId: string
    targetType: string
    targetId: string
}

type TaxonomyLink = TaxonomyLinkInput & {
    id: string
}

type TaxonomyTreeNode = TaxonomyNode & {
    depth: number
}

type TaxonomyNodeRow = {
    id: string
    parent_id: string | null
    name: string
    summary: string | null
}

type TaxonomyTreeRow = TaxonomyNodeRow & {
    depth: number
}

type TaxonomyLinkRow = {
    id: string
    node_id: string
    target_type: string
    target_id: string
}

type PathRow = {
    id_path: string
    name_path: string
}

export default class TaxonomyStore {
    constructor(private readonly adapter: SqliteAdapter) {}

    async upsertNode(input: TaxonomyNodeInput): Promise<TaxonomyNode> {
        const existing = await this.findSiblingByName(
            input.parentId,
            input.name,
        )
        const now = new Date().toISOString()

        if (existing) {
            await this.adapter.execute(
                `
update taxonomy_nodes
set summary = coalesce(?, summary), updated_at = ?
where id = ?
`,
                [input.summary ?? null, now, existing.id],
            )
            return {
                ...existing,
                summary: input.summary ?? existing.summary,
            }
        }

        const node: TaxonomyNode = {
            id: `tax_${randomUUID()}`,
            name: input.name,
            parentId: input.parentId,
            summary: input.summary,
        }
        await this.adapter.execute(
            `
insert into taxonomy_nodes (
    id,
    parent_id,
    name,
    summary,
    created_at,
    updated_at
) values (?, ?, ?, ?, ?, ?)
`,
            [
                node.id,
                input.parentId ?? null,
                input.name,
                input.summary ?? null,
                now,
                now,
            ],
        )

        return node
    }

    async linkTarget(input: TaxonomyLinkInput): Promise<TaxonomyLink> {
        const existing = await this.findLink(input)
        if (existing) {
            return existing
        }

        const link: TaxonomyLink = {
            id: `taxlink_${randomUUID()}`,
            nodeId: input.nodeId,
            targetId: input.targetId,
            targetType: input.targetType,
        }
        await this.adapter.execute(
            `
insert into taxonomy_links (
    id,
    node_id,
    target_type,
    target_id,
    created_at
) values (?, ?, ?, ?, ?)
`,
            [
                link.id,
                input.nodeId,
                input.targetType,
                input.targetId,
                new Date().toISOString(),
            ],
        )

        return link
    }

    async listLinks(nodeId: string): Promise<TaxonomyLink[]> {
        const rows = await this.adapter.query<TaxonomyLinkRow>(
            `
select id, node_id, target_type, target_id
from taxonomy_links
where node_id = ?
order by target_type, target_id
`,
            [nodeId],
        )

        return rows.map(linkFromRow)
    }

    async getSubtree(
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
            ...nodeFromRow(row),
            depth: row.depth,
        }))
    }

    async getPath(nodeId: string): Promise<TaxonomyNode[]> {
        const rows = await this.adapter.query<PathRow>(
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

    private async findSiblingByName(
        parentId: string | undefined,
        name: string,
    ): Promise<TaxonomyNode | undefined> {
        const rows = await this.adapter.query<TaxonomyNodeRow>(
            `
select id, parent_id, name, summary
from taxonomy_nodes
where ${parentId ? 'parent_id = ?' : 'parent_id is null'} and lower(name) = lower(?)
limit 1
`,
            parentId ? [parentId, name] : [name],
        )

        return rows[0] ? nodeFromRow(rows[0]) : undefined
    }

    private async findLink(
        input: TaxonomyLinkInput,
    ): Promise<TaxonomyLink | undefined> {
        const rows = await this.adapter.query<TaxonomyLinkRow>(
            `
select id, node_id, target_type, target_id
from taxonomy_links
where node_id = ? and target_type = ? and target_id = ?
limit 1
`,
            [input.nodeId, input.targetType, input.targetId],
        )

        return rows[0] ? linkFromRow(rows[0]) : undefined
    }
}

// biome-ignore lint/suspicious/noExplicitAny: WILL FIX THIS LATER
function nodeFromRow(row: any): TaxonomyNode {
    return {
        id: row.id,
        name: row.name,
        parentId: row.parent_id ?? row.parentId ?? undefined,
        summary: row.summary ?? undefined,
    }
}

// biome-ignore lint/suspicious/noExplicitAny: WILL FIX THIS LATER
function linkFromRow(row: any): TaxonomyLink {
    return {
        id: row.id,
        nodeId: row.node_id ?? row.nodeId,
        targetId: row.target_id ?? row.targetId,
        targetType: row.target_type ?? row.targetType,
    }
}

function clampDepth(depth: number): number {
    return Math.max(0, Math.min(Math.trunc(depth), 8))
}

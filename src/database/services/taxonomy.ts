import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import db from '../actions/_db'

export type TaxonomyNodeInput = {
    parentId?: string
    name: string
    summary?: string
}

export type TaxonomyNode = {
    id: string
    parentId?: string
    name: string
    summary?: string
}

export type TaxonomyLinkInput = {
    nodeId: string
    targetType: string
    targetId: string
}

export type TaxonomyLink = TaxonomyLinkInput & {
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

type TaxonomyPathRow = {
    id_path: string
    name_path: string
}

export async function upsertNode(
    input: TaxonomyNodeInput,
): Promise<TaxonomyNode> {
    await db.ensureActionDatabase()
    const existing = await findSiblingByName(input.parentId, input.name)
    const now = new Date().toISOString()

    if (existing) {
        await db.run(sql`
update taxonomy_nodes
set summary = coalesce(${input.summary ?? null}, summary),
    updated_at = ${now}
where id = ${existing.id}
`)
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
    await db.run(sql`
insert into taxonomy_nodes (id, parent_id, name, summary, created_at, updated_at)
values (${node.id}, ${input.parentId ?? null}, ${input.name}, ${input.summary ?? null}, ${now}, ${now})
`)

    return node
}

export async function linkTarget(
    input: TaxonomyLinkInput,
): Promise<TaxonomyLink> {
    await db.ensureActionDatabase()
    const existing = await findLink(input)
    if (existing) {
        return existing
    }

    const link: TaxonomyLink = {
        id: `taxlink_${randomUUID()}`,
        nodeId: input.nodeId,
        targetId: input.targetId,
        targetType: input.targetType,
    }
    await db.run(sql`
insert into taxonomy_links (id, node_id, target_type, target_id, created_at)
values (${link.id}, ${input.nodeId}, ${input.targetType}, ${input.targetId}, ${new Date().toISOString()})
`)

    return link
}

export async function listLinks(nodeId: string): Promise<TaxonomyLink[]> {
    await db.ensureActionDatabase()
    const rows = await db.all<TaxonomyLinkRow>(sql`
select id, node_id, target_type, target_id
from taxonomy_links
where node_id = ${nodeId}
order by target_type, target_id
`)

    return rows.map(taxonomyLinkFromRow)
}

export async function getSubtree(
    rootId?: string,
    options: { maxDepth?: number } = {},
): Promise<TaxonomyTreeNode[]> {
    await db.ensureActionDatabase()
    const maxDepth = clampDepth(options.maxDepth ?? 4)
    const rows = await db.all<TaxonomyTreeRow>(
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

    return rows.map(row => ({
        ...taxonomyNodeFromRow(row),
        depth: row.depth,
    }))
}

export async function getPath(nodeId: string): Promise<TaxonomyNode[]> {
    await db.ensureActionDatabase()
    const rows = await db.all<TaxonomyPathRow>(sql`
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

async function findSiblingByName(
    parentId: string | undefined,
    name: string,
): Promise<TaxonomyNode | undefined> {
    const rows = await db.all<TaxonomyNodeRow>(sql`
select id, parent_id, name, summary
from taxonomy_nodes
where ${parentId ? sql`parent_id = ${parentId}` : sql`parent_id is null`}
  and lower(name) = lower(${name})
limit 1
`)

    return rows[0] ? taxonomyNodeFromRow(rows[0]) : undefined
}

async function findLink(
    input: TaxonomyLinkInput,
): Promise<TaxonomyLink | undefined> {
    const rows = await db.all<TaxonomyLinkRow>(sql`
select id, node_id, target_type, target_id
from taxonomy_links
where node_id = ${input.nodeId}
  and target_type = ${input.targetType}
  and target_id = ${input.targetId}
limit 1
`)

    return rows[0] ? taxonomyLinkFromRow(rows[0]) : undefined
}

function taxonomyNodeFromRow(row: TaxonomyNodeRow): TaxonomyNode {
    return {
        id: row.id,
        name: row.name,
        parentId: row.parent_id ?? undefined,
        summary: row.summary ?? undefined,
    }
}

function taxonomyLinkFromRow(row: TaxonomyLinkRow): TaxonomyLink {
    return {
        id: row.id,
        nodeId: row.node_id,
        targetId: row.target_id,
        targetType: row.target_type,
    }
}

function clampDepth(depth: number): number {
    return Math.max(0, Math.min(Math.trunc(depth), 8))
}

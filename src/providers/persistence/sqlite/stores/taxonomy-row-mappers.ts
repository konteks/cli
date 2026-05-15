import type {
    TaxonomyLink,
    TaxonomyLinkRow,
    TaxonomyNode,
    TaxonomyNodeRow,
} from './taxonomy-types'

export function taxonomyNodeFromRow(row: TaxonomyNodeRow): TaxonomyNode {
    return {
        id: row.id,
        name: row.name,
        parentId: row.parent_id ?? undefined,
        summary: row.summary ?? undefined,
    }
}

export function taxonomyLinkFromRow(row: TaxonomyLinkRow): TaxonomyLink {
    return {
        id: row.id,
        nodeId: row.node_id,
        targetId: row.target_id,
        targetType: row.target_type,
    }
}

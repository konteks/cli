import type {
    TaxonomyNode,
    TaxonomyTreeNode,
} from '@/database/services/taxonomy'
import queryTaxonomySubtreeRows, {
    type TaxonomyNodeRow,
} from './query-taxonomy-subtree-rows'

export default async function getTaxonomySubtree(
    rootId?: string,
    options: { maxDepth?: number } = {},
): Promise<TaxonomyTreeNode[]> {
    const rows = await queryTaxonomySubtreeRows(
        rootId,
        clampDepth(options.maxDepth ?? 4),
    )

    return rows.map(row => ({
        ...taxonomyNodeFromRow(row),
        depth: row.depth,
    }))
}

function taxonomyNodeFromRow(row: TaxonomyNodeRow): TaxonomyNode {
    return {
        id: row.id,
        name: row.name,
        parentId: row.parent_id ?? undefined,
        summary: row.summary ?? undefined,
    }
}

function clampDepth(depth: number): number {
    return Math.max(0, Math.min(Math.trunc(depth), 8))
}

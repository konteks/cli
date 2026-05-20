import { eq, isNull } from 'drizzle-orm'
import { taxonomyNodes } from '@/database/schema'
import type { TaxonomyNode } from '@/database/services/taxonomy'
import db from './_db'
import type { TaxonomyNodeRow } from './query-taxonomy-subtree-rows'

export default async function findTaxonomySiblingByName(
    parentId: string | undefined,
    name: string,
): Promise<TaxonomyNode | undefined> {
    const rows = await db
        .select({
            id: taxonomyNodes.id,
            name: taxonomyNodes.name,
            parent_id: taxonomyNodes.parentId,
            summary: taxonomyNodes.summary,
        })
        .from(taxonomyNodes)
        .where(
            parentId
                ? eq(taxonomyNodes.parentId, parentId)
                : isNull(taxonomyNodes.parentId),
        )

    const row = rows.find(
        candidate => candidate.name.toLowerCase() === name.toLowerCase(),
    )
    return row ? taxonomyNodeFromRow(row) : undefined
}

function taxonomyNodeFromRow(row: TaxonomyNodeRow): TaxonomyNode {
    return {
        id: row.id,
        name: row.name,
        parentId: row.parent_id ?? undefined,
        summary: row.summary ?? undefined,
    }
}

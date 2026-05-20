import { asc, eq } from 'drizzle-orm'
import { taxonomyLinks } from '@/database/schema'
import type { TaxonomyLink } from '@/database/services/taxonomy'
import db from './_db'

type TaxonomyLinkRow = {
    id: string
    node_id: string
    target_type: string
    target_id: string
}

export default async function listTaxonomyLinks(
    nodeId: string,
): Promise<TaxonomyLink[]> {
    await db.ensureActionDatabase()
    const rows = await db
        .select({
            id: taxonomyLinks.id,
            node_id: taxonomyLinks.nodeId,
            target_id: taxonomyLinks.targetId,
            target_type: taxonomyLinks.targetType,
        })
        .from(taxonomyLinks)
        .where(eq(taxonomyLinks.nodeId, nodeId))
        .orderBy(asc(taxonomyLinks.targetType), asc(taxonomyLinks.targetId))

    return rows.map(taxonomyLinkFromRow)
}

function taxonomyLinkFromRow(row: TaxonomyLinkRow): TaxonomyLink {
    return {
        id: row.id,
        nodeId: row.node_id,
        targetId: row.target_id,
        targetType: row.target_type,
    }
}

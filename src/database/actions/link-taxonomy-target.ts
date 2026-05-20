import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { taxonomyLinks } from '@/database/schema'
import type {
    TaxonomyLink,
    TaxonomyLinkInput,
} from '@/database/services/taxonomy'
import getDb from './_db'

type TaxonomyLinkRow = {
    id: string
    node_id: string
    target_type: string
    target_id: string
}

export default async function linkTaxonomyTarget(
    input: TaxonomyLinkInput,
): Promise<TaxonomyLink> {
    const db = await getDb()
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
    await db.insert(taxonomyLinks).values({
        createdAt: new Date().toISOString(),
        id: link.id,
        nodeId: input.nodeId,
        targetId: input.targetId,
        targetType: input.targetType,
    })

    return link
}

async function findLink(
    input: TaxonomyLinkInput,
): Promise<TaxonomyLink | undefined> {
    const db = await getDb()
    const rows = await db
        .select({
            id: taxonomyLinks.id,
            node_id: taxonomyLinks.nodeId,
            target_id: taxonomyLinks.targetId,
            target_type: taxonomyLinks.targetType,
        })
        .from(taxonomyLinks)
        .where(
            and(
                eq(taxonomyLinks.nodeId, input.nodeId),
                eq(taxonomyLinks.targetType, input.targetType),
                eq(taxonomyLinks.targetId, input.targetId),
            ),
        )
        .limit(1)

    return rows[0] ? taxonomyLinkFromRow(rows[0]) : undefined
}

function taxonomyLinkFromRow(row: TaxonomyLinkRow): TaxonomyLink {
    return {
        id: row.id,
        nodeId: row.node_id,
        targetId: row.target_id,
        targetType: row.target_type,
    }
}

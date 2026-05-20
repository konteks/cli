import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { taxonomyNodes } from '@/database/schema'
import type {
    TaxonomyNode,
    TaxonomyNodeInput,
} from '@/database/services/taxonomy'
import getDb from './_db'
import findTaxonomySiblingByName from './find-taxonomy-sibling-by-name'

export default async function upsertTaxonomyNode(
    input: TaxonomyNodeInput,
): Promise<TaxonomyNode> {
    const db = await getDb()
    const existing = await findTaxonomySiblingByName(input.parentId, input.name)
    const now = new Date().toISOString()

    if (existing) {
        await db
            .update(taxonomyNodes)
            .set({
                ...(input.summary !== undefined
                    ? { summary: input.summary }
                    : {}),
                updatedAt: now,
            })
            .where(eq(taxonomyNodes.id, existing.id))
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
    await db.insert(taxonomyNodes).values({
        createdAt: now,
        id: node.id,
        name: input.name,
        parentId: input.parentId ?? null,
        summary: input.summary ?? null,
        updatedAt: now,
    })

    return node
}

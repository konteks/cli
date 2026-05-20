import { minedSuppressions } from '@/database/schema'
import getDb from './_db'

export type InsertMinedSuppressionInput = {
    anchor: string
    contentHash: string
    createdAt: string
    path: string
    reason?: string | null
}

export default async function insertMinedSuppression(
    input: InsertMinedSuppressionInput,
): Promise<void> {
    const db = await getDb()
    await db.insert(minedSuppressions).values({
        anchor: input.anchor,
        contentHash: input.contentHash,
        createdAt: input.createdAt,
        path: input.path,
        reason: input.reason ?? null,
    })
}

import { eq } from 'drizzle-orm'
import { relations } from '@/database/schema'
import getDb from './_db'

export default async function invalidateRelation(
    id: string,
    validTo?: string,
): Promise<void> {
    const db = await getDb()
    const now = new Date().toISOString()
    await db
        .update(relations)
        .set({
            status: 'invalidated',
            updatedAt: now,
            validTo: validTo ?? now,
        })
        .where(eq(relations.id, id))
}

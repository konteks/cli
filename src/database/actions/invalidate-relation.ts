import { eq } from 'drizzle-orm'
import { relations } from '@/database/schema'
import getDb from './_db'

export default async function invalidateRelation(
    id: string,
    validTo?: string,
): Promise<void> {
    const db = await getDb()
    await db
        .update(relations)
        .set({
            status: 'invalidated',
            updatedAt: new Date().toISOString(),
            ...(validTo !== undefined ? { validTo } : {}),
        })
        .where(eq(relations.id, id))
}

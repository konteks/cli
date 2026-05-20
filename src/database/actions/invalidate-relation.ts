import { eq } from 'drizzle-orm'
import { relations } from '@/database/schema'
import db from './_db'

export default async function invalidateRelation(
    id: string,
    validTo?: string,
): Promise<void> {
    await db.ensureActionDatabase()
    await db
        .update(relations)
        .set({
            status: 'invalidated',
            updatedAt: new Date().toISOString(),
            ...(validTo !== undefined ? { validTo } : {}),
        })
        .where(eq(relations.id, id))
}

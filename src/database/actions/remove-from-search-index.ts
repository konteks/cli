import { eq } from 'drizzle-orm'
import { memoryFts, memoryFtsIndexed } from '@/database/schema'
import getDb from './_db'

export default async function removeFromSearchIndex(id: string): Promise<void> {
    const db = await getDb()
    await db.delete(memoryFts).where(eq(memoryFts.id, id))
    await db.delete(memoryFtsIndexed).where(eq(memoryFtsIndexed.id, id))
}

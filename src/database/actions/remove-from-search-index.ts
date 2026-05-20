import { eq } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { memoryFts, memoryFtsIndexed } from '@/database/schema'

export default async function removeFromSearchIndex(
    db: SqliteConnection,
    id: string,
): Promise<void> {
    await db.db.delete(memoryFts).where(eq(memoryFts.id, id))
    await db.db.delete(memoryFtsIndexed).where(eq(memoryFtsIndexed.id, id))
}

import { eq } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { diaryEntries } from '@/database/schema'

export default async function hasDiaryHash(
    db: SqliteConnection,
    hash: string,
): Promise<boolean> {
    const rows = await db.db
        .select({ id: diaryEntries.id })
        .from(diaryEntries)
        .where(eq(diaryEntries.contentHash, hash))
        .limit(1)

    return rows.length > 0
}

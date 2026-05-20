import { eq } from 'drizzle-orm'
import { diaryEntries } from '@/database/schema'
import getDb from './_db'

export default async function hasDiaryHash(hash: string): Promise<boolean> {
    const db = await getDb()
    const rows = await db
        .select({ id: diaryEntries.id })
        .from(diaryEntries)
        .where(eq(diaryEntries.contentHash, hash))
        .limit(1)

    return rows.length > 0
}

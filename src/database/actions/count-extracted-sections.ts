import { count } from 'drizzle-orm'
import { chunks } from '@/database/schema'
import getDb from './_db'

export default async function countExtractedSections(): Promise<number> {
    const db = await getDb()
    const rows = await db.select({ count: count() }).from(chunks)
    return rows[0]?.count ?? 0
}

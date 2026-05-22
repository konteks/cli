import { count } from 'drizzle-orm'
import { sections } from '@/database/schema'
import getDb from './_db'

export default async function countExtractedSections(): Promise<number> {
    const db = await getDb()
    const rows = await db.select({ count: count() }).from(sections)
    return rows[0]?.count ?? 0
}

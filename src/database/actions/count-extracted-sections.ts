import { count } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { chunks } from '@/database/schema'

export default async function countExtractedSections(
    connection: SqliteConnection,
): Promise<number> {
    const rows = await connection.db.select({ count: count() }).from(chunks)
    return rows[0]?.count ?? 0
}

import { eq } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { observations } from '@/database/schema'

export default async function hasObservationHash(
    db: SqliteConnection,
    hash: string,
): Promise<boolean> {
    const rows = await db.db
        .select({ id: observations.id })
        .from(observations)
        .where(eq(observations.contentHash, hash))
        .limit(1)

    return rows.length > 0
}

import { and, eq, isNull } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { observations } from '@/database/schema'

export default async function findDuplicateObservation(
    db: SqliteConnection,
    hash: string,
): Promise<{ id: string } | undefined> {
    const rows = await db.db
        .select({ id: observations.id })
        .from(observations)
        .where(
            and(
                eq(observations.contentHash, hash),
                isNull(observations.deletedAt),
                isNull(observations.suppressedAt),
            ),
        )
        .limit(1)

    return rows[0]
}

import { and, eq, isNull } from 'drizzle-orm'
import { observations } from '@/database/schema'
import getDb from './_db'

export default async function findDuplicateObservation(
    hash: string,
): Promise<{ id: string } | undefined> {
    const db = await getDb()
    const rows = await db
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

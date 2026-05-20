import { eq } from 'drizzle-orm'
import { observations } from '@/database/schema'
import getDb from './_db'

export default async function hasObservationHash(
    hash: string,
): Promise<boolean> {
    const db = await getDb()
    const rows = await db
        .select({ id: observations.id })
        .from(observations)
        .where(eq(observations.contentHash, hash))
        .limit(1)

    return rows.length > 0
}

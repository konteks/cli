import { and, desc, isNull } from 'drizzle-orm'
import { observations } from '@/database/schema'
import type { WarmUpObservationRow } from '@/providers/project/warm-up-ranking'
import getDb from './_db'

export default async function queryWarmUpObservations(): Promise<
    WarmUpObservationRow[]
> {
    const db = await getDb()
    return db
        .select({
            id: observations.id,
            kind: observations.kind,
            text_inline: observations.textInline,
        })
        .from(observations)
        .where(
            and(
                isNull(observations.deletedAt),
                isNull(observations.suppressedAt),
            ),
        )
        .orderBy(desc(observations.createdAt))
        .limit(120)
}

import { and, desc, isNull, or, sql } from 'drizzle-orm'
import { observations } from '@/providers/persistence/sqlite/schema'
import db from './_db'

export type ObservationRow = {
    id: string
    kind: string
    text_inline: string | null
    confidence: number
    created_at: string
}

export default async function queryObservations(
    terms: string[],
    limit: number,
): Promise<ObservationRow[]> {
    return db
        .select({
            confidence: observations.confidence,
            created_at: observations.createdAt,
            id: observations.id,
            kind: observations.kind,
            text_inline: observations.textInline,
        })
        .from(observations)
        .where(
            and(
                or(
                    ...terms.map(
                        term =>
                            sql`lower(coalesce(${observations.textInline}, '')) like ${`%${term}%`}`,
                    ),
                ),
                isNull(observations.deletedAt),
                isNull(observations.suppressedAt),
            ),
        )
        .orderBy(desc(observations.createdAt))
        .limit(limit)
}

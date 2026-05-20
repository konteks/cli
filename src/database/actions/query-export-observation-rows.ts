import { and, asc, isNull } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { observations } from '@/database/schema'
import type { ObservationExportRow } from '@/database/support/memory-transfer-types'

export default async function queryExportObservationRows(
    db: SqliteConnection,
    options: { includeInactive?: boolean },
): Promise<ObservationExportRow[]> {
    return await db.db
        .select({
            confidence: observations.confidence,
            content_hash: observations.contentHash,
            created_at: observations.createdAt,
            deleted_at: observations.deletedAt,
            forget_reason: observations.forgetReason,
            id: observations.id,
            kind: observations.kind,
            payload_ref: observations.payloadRef,
            suppressed_at: observations.suppressedAt,
            text_inline: observations.textInline,
        })
        .from(observations)
        .$dynamic()
        .where(
            options.includeInactive
                ? undefined
                : and(
                      isNull(observations.deletedAt),
                      isNull(observations.suppressedAt),
                  ),
        )
        .orderBy(asc(observations.createdAt))
}

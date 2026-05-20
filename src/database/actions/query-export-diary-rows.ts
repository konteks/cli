import { and, asc, isNull } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { diaryEntries } from '@/database/schema'
import type { DiaryExportRow } from '@/database/support/memory-transfer-types'

export default async function queryExportDiaryRows(
    db: SqliteConnection,
    options: { includeInactive?: boolean },
): Promise<DiaryExportRow[]> {
    return await db.db
        .select({
            content_hash: diaryEntries.contentHash,
            created_at: diaryEntries.createdAt,
            deleted_at: diaryEntries.deletedAt,
            forget_reason: diaryEntries.forgetReason,
            id: diaryEntries.id,
            payload_ref: diaryEntries.payloadRef,
            subject: diaryEntries.subject,
            summary: diaryEntries.summary,
            suppressed_at: diaryEntries.suppressedAt,
            tags_json: diaryEntries.tagsJson,
        })
        .from(diaryEntries)
        .$dynamic()
        .where(
            options.includeInactive
                ? undefined
                : and(
                      isNull(diaryEntries.deletedAt),
                      isNull(diaryEntries.suppressedAt),
                  ),
        )
        .orderBy(asc(diaryEntries.createdAt))
}

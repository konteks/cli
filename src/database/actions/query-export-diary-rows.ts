import { and, asc, isNull } from 'drizzle-orm'
import { diaryEntries } from '@/database/schema'
import type { DiaryExportRow } from '@/database/support/memory-transfer-types'
import getDb from './_db'

export default async function queryExportDiaryRows(options: {
    includeInactive?: boolean
}): Promise<DiaryExportRow[]> {
    const db = await getDb()
    return await db
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

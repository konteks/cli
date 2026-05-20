import { and, asc, isNull } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { diaryEntries, observations } from '@/database/schema'
import {
    exportDiaryRow,
    exportObservationRow,
} from '@/database/support/memory-transfer'
import type { DurableMemoryExport } from '@/models/memory-transfer'
import type { Project } from '@/models/project'
import createToonStore from '@/providers/persistence/objects/create-toon-store'

export default async function exportDurableMemory(
    db: SqliteConnection,
    context: Project,
    options: { includeInactive?: boolean },
): Promise<DurableMemoryExport> {
    const toonStore = createToonStore(context.memoryDir)
    const memoryRows = await db.db
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
    const diaryRows = await db.db
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

    return {
        diaries: await Promise.all(
            diaryRows.map(row => exportDiaryRow(row, toonStore)),
        ),
        exportedAt: new Date().toISOString(),
        format: 'konteks.durable-memory.v1',
        memories: await Promise.all(
            memoryRows.map(row => exportObservationRow(row, toonStore)),
        ),
        project: {
            root: context.projectRoot,
        },
    }
}

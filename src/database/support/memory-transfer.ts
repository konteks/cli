import type {
    DiaryExportRow,
    ObservationExportRow,
} from '@/database/support/memory-transfer-types'
import contentHash from '@/support/content-hash'
import type {
    DurableMemoryExportDiary,
    DurableMemoryExportMemory,
} from '@/types/memory-transfer'

export function exportObservationRow(
    row: ObservationExportRow,
): DurableMemoryExportMemory {
    const content = row.text_inline ?? ''
    return {
        confidence: row.confidence,
        content,
        contentHash: row.content_hash ?? contentHash(content),
        createdAt: row.created_at,
        deletedAt: row.deleted_at ?? undefined,
        forgetReason: row.forget_reason ?? undefined,
        id: row.id,
        kind: row.kind,
        suppressedAt: row.suppressed_at ?? undefined,
    }
}

export function exportDiaryRow(row: DiaryExportRow): DurableMemoryExportDiary {
    const tags = parseTags(row.tags_json)
    const hashSource = [row.subject, row.summary, tags.join(', ')]
        .filter(Boolean)
        .join('\n')
    return {
        contentHash: row.content_hash ?? contentHash(hashSource || row.summary),
        createdAt: row.created_at,
        deletedAt: row.deleted_at ?? undefined,
        forgetReason: row.forget_reason ?? undefined,
        id: row.id,
        subject: row.subject ?? undefined,
        summary: row.summary,
        suppressedAt: row.suppressed_at ?? undefined,
        tags,
    }
}

function parseTags(raw: string | null): string[] {
    if (!raw) {
        return []
    }
    try {
        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed)
            ? parsed.filter(value => typeof value === 'string')
            : []
    } catch {
        return []
    }
}

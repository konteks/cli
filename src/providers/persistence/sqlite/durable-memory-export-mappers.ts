import type {
    DurableMemoryExportDiary,
    DurableMemoryExportMemory,
} from '@/models/memory-transfer'
import { contentHash } from '@/providers/persistence/objects/content'
import type createToonStore from '@/providers/persistence/objects/create-toon-store'
import type {
    DiaryExportRow,
    ObservationExportRow,
} from './durable-memory-transfer-types'

export async function exportObservationRow(
    row: ObservationExportRow,
    toonStore: ReturnType<typeof createToonStore>,
): Promise<DurableMemoryExportMemory> {
    const content = await resolveContent(
        row.text_inline,
        row.payload_ref,
        toonStore,
    )
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

export async function exportDiaryRow(
    row: DiaryExportRow,
    toonStore: ReturnType<typeof createToonStore>,
): Promise<DurableMemoryExportDiary> {
    const text = await resolveContent(row.summary, row.payload_ref, toonStore)
    const tags = parseTags(row.tags_json)
    const hashSource = [row.subject, row.summary, tags.join(', ')]
        .filter(Boolean)
        .join('\n')
    return {
        contentHash: row.content_hash ?? contentHash(hashSource || text),
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

async function resolveContent(
    inline: string | null,
    payloadRef: string | null,
    toonStore: ReturnType<typeof createToonStore>,
): Promise<string> {
    if (payloadRef) {
        return await toonStore.read(payloadRef)
    }
    return inline ?? ''
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

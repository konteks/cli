import type { DurableMemoryExportMemory } from '@/types/memory-transfer'

export type ObservationExportRow = {
    confidence: number
    content_hash: string | null
    created_at: string
    deleted_at: string | null
    forget_reason: string | null
    id: string
    kind: DurableMemoryExportMemory['kind']
    suppressed_at: string | null
    text_inline: string | null
}

export type DiaryExportRow = {
    content_hash: string | null
    created_at: string
    deleted_at: string | null
    forget_reason: string | null
    id: string
    subject: string | null
    summary: string
    suppressed_at: string | null
    tags_json: string | null
}

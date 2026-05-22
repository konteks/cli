import { randomUUID } from 'node:crypto'
import { withTransaction } from '@/database/actions/_db'
import indexSearchDocument from '@/database/actions/index-search-document'
import insertDiaryEntry from '@/database/actions/insert-diary-entry'
import insertObservation from '@/database/actions/insert-observation'
import upsertRetrievalDocument from '@/database/actions/upsert-retrieval-document'
import contentHash from '@/support/content-hash'
import type {
    DurableMemoryExportDiary,
    DurableMemoryExportMemory,
} from '@/types/memory-transfer'
import type { Project } from '@/types/project'

export async function insertImportedObservation(
    _context: Project,
    memory: DurableMemoryExportMemory,
): Promise<void> {
    const id = `obs_${randomUUID()}`
    const createdAt = memory.createdAt || new Date().toISOString()

    await withTransaction(async () => {
        await insertObservation({
            confidence: memory.confidence,
            contentHash: memory.contentHash || contentHash(memory.content),
            createdAt,
            deletedAt: memory.deletedAt ?? null,
            forgetReason: memory.forgetReason ?? null,
            id,
            kind: memory.kind,
            suppressedAt: memory.suppressedAt ?? null,
            textInline: memory.content,
        })
        await indexSearchDocument({
            content: memory.content,
            createdAt,
            id,
            kind: memory.kind,
            type: 'memory',
        })
        await upsertRetrievalDocument({
            anchor: id,
            embeddingText: memory.content,
            ftsText: memory.content,
            path: 'memory',
            sourceRole: 'unknown',
            summary: memory.content.slice(0, 240),
            targetId: id,
            targetType: 'memory',
            updatedAt: createdAt,
        })
    })
}

export async function insertImportedDiary(
    _context: Project,
    diary: DurableMemoryExportDiary,
): Promise<void> {
    const id = `diary_${randomUUID()}`
    const text = [diary.subject, diary.summary, diary.tags.join(', ')]
        .filter(Boolean)
        .join('\n')
    const createdAt = diary.createdAt || new Date().toISOString()

    await withTransaction(async () => {
        await insertDiaryEntry({
            contentHash: diary.contentHash || contentHash(text),
            createdAt,
            deletedAt: diary.deletedAt ?? null,
            forgetReason: diary.forgetReason ?? null,
            id,
            subject: diary.subject ?? null,
            summary: diary.summary,
            suppressedAt: diary.suppressedAt ?? null,
            tagsJson: JSON.stringify(diary.tags),
        })
        await indexSearchDocument({
            content: text,
            createdAt,
            id,
            kind: 'diary',
            type: 'diary',
        })
        await upsertRetrievalDocument({
            anchor: diary.subject ?? id,
            embeddingText: text,
            ftsText: text,
            path: 'diary',
            sourceRole: 'unknown',
            summary: diary.summary,
            targetId: id,
            targetType: 'diary',
            updatedAt: createdAt,
        })
    })
}

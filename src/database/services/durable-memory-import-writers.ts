import { randomUUID } from 'node:crypto'
import { withTransaction } from '@/database/actions/_db'
import indexSearchDocument from '@/database/actions/index-search-document'
import insertDiaryEntry from '@/database/actions/insert-diary-entry'
import insertObservation from '@/database/actions/insert-observation'
import upsertRetrievalDocument from '@/database/actions/upsert-retrieval-document'
import createToonStore from '@/modules/persistence/objects/create-toon-store'
import storePayload from '@/modules/persistence/objects/store-payload'
import type {
    DurableMemoryExportDiary,
    DurableMemoryExportMemory,
} from '@/types/memory-transfer'
import type { Project } from '@/types/project'

export async function insertImportedObservation(
    context: Project,
    memory: DurableMemoryExportMemory,
): Promise<void> {
    const id = `obs_${randomUUID()}`
    const stored = await storePayload(memory.content, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const createdAt = memory.createdAt || new Date().toISOString()

    await withTransaction(async () => {
        await insertObservation({
            confidence: memory.confidence,
            contentHash: stored.contentHash,
            createdAt,
            deletedAt: memory.deletedAt ?? null,
            forgetReason: memory.forgetReason ?? null,
            id,
            kind: memory.kind,
            payloadRef: stored.payloadRef ?? null,
            suppressedAt: memory.suppressedAt ?? null,
            textInline: stored.contentInline ?? memory.content.slice(0, 240),
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
    context: Project,
    diary: DurableMemoryExportDiary,
): Promise<void> {
    const id = `diary_${randomUUID()}`
    const text = [diary.subject, diary.summary, diary.tags.join(', ')]
        .filter(Boolean)
        .join('\n')
    const stored = await storePayload(text, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const createdAt = diary.createdAt || new Date().toISOString()

    await withTransaction(async () => {
        await insertDiaryEntry({
            contentHash: stored.contentHash,
            createdAt,
            deletedAt: diary.deletedAt ?? null,
            forgetReason: diary.forgetReason ?? null,
            id,
            payloadRef: stored.payloadRef ?? null,
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

import { randomUUID } from 'node:crypto'
import type {
    DurableMemoryExportDiary,
    DurableMemoryExportMemory,
} from '@/models/memory-transfer'
import type { Project } from '@/models/project'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import storePayload from '@/providers/persistence/objects/store-payload'
import { upsertRetrievalDocument } from '@/providers/persistence/sqlite/retrieval-documents'
import { indexSearchDocument } from '@/providers/persistence/sqlite/search-index'
import type DatabaseService from './database-service'
import { executeSql } from './libsql-helpers'

export async function insertImportedObservation(
    db: DatabaseService,
    context: Project,
    memory: DurableMemoryExportMemory,
): Promise<void> {
    const id = `obs_${randomUUID()}`
    const stored = await storePayload(memory.content, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const createdAt = memory.createdAt || new Date().toISOString()

    await db.transaction(async tx => {
        await executeSql(
            tx.client,
            `
insert into observations (
    id, kind, text_inline, payload_ref, content_hash, confidence, created_at, deleted_at, suppressed_at, forget_reason
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                id,
                memory.kind,
                stored.contentInline ?? memory.content.slice(0, 240),
                stored.payloadRef ?? null,
                stored.contentHash,
                memory.confidence,
                createdAt,
                memory.deletedAt ?? null,
                memory.suppressedAt ?? null,
                memory.forgetReason ?? null,
            ],
        )
        await indexSearchDocument(tx, {
            content: memory.content,
            createdAt,
            id,
            kind: memory.kind,
            type: 'memory',
        })
        await upsertRetrievalDocument(tx, {
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
    db: DatabaseService,
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

    await db.transaction(async tx => {
        await executeSql(
            tx.client,
            `
insert into diary_entries (
    id, subject, summary, tags_json, payload_ref, content_hash, deleted_at, suppressed_at, forget_reason, created_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                id,
                diary.subject ?? null,
                diary.summary,
                JSON.stringify(diary.tags),
                stored.payloadRef ?? null,
                stored.contentHash,
                diary.deletedAt ?? null,
                diary.suppressedAt ?? null,
                diary.forgetReason ?? null,
                createdAt,
            ],
        )
        await indexSearchDocument(tx, {
            content: text,
            createdAt,
            id,
            kind: 'diary',
            type: 'diary',
        })
        await upsertRetrievalDocument(tx, {
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

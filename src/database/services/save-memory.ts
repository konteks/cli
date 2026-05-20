import { randomUUID } from 'node:crypto'
import type {
    SaveDiaryInput,
    SaveMemoriesInput,
    SaveMemoryInput,
    SaveOptions,
    SaveSessionInput,
} from '@/contracts/repositories/memory-repository'
import { type SqliteConnection, withTransaction } from '@/database/actions/_db'
import appendMemoryEvent from '@/database/actions/append-memory-event'
import findDuplicateObservation from '@/database/actions/find-duplicate-observation'
import indexSearchDocument from '@/database/actions/index-search-document'
import insertDiaryEntry from '@/database/actions/insert-diary-entry'
import insertObservation from '@/database/actions/insert-observation'
import upsertRetrievalDocument from '@/database/actions/upsert-retrieval-document'
import withBoundActionDatabase from '@/database/actions/with-bound-action-database'
import {
    importanceToConfidence,
    isSkippableMemoryError,
    summarizeText,
    validateMemoryQuality,
    validateSessionQuality,
    withProjectUpdateSummary,
} from '@/database/support/save-policy'
import type { SaveResult } from '@/models/memory'
import type { Project } from '@/models/project'
import { contentHash } from '@/providers/persistence/objects/content'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import storePayload from '@/providers/persistence/objects/store-payload'

export async function saveKonteksMemory(
    db: SqliteConnection,
    context: Project,
    input: SaveMemoryInput,
    _options: SaveOptions = {},
): Promise<SaveResult> {
    validateMemoryQuality(input.content)
    const hash = contentHash(input.content)
    const duplicate = await withBoundActionDatabase(db, () =>
        findDuplicateObservation(hash),
    )
    if (duplicate) {
        return {
            accepted: true,
            duplicateOf: duplicate.id,
            id: duplicate.id,
            memoryIds: [duplicate.id],
        }
    }

    const id = `obs_${randomUUID()}`
    const stored = await storePayload(input.content, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const summary = summarizeText(input.content)
    const createdAt = new Date().toISOString()

    await withTransaction(db, async () => {
        await insertObservation({
            confidence: importanceToConfidence(input.importance),
            contentHash: stored.contentHash,
            createdAt,
            id,
            kind: input.kind,
            payloadRef: stored.payloadRef ?? null,
            textInline: stored.contentInline ?? summary,
        })

        await appendMemoryEvent({
            actor: 'mcp',
            eventType: 'memory_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'observation',
            summary,
        })

        await indexSearchDocument({
            content: stored.contentInline ?? summary,
            createdAt,
            id,
            kind: input.kind,
            type: 'memory',
        })
        await upsertRetrievalDocument({
            anchor: input.source ?? id,
            embeddingText: stored.contentInline ?? input.content,
            ftsText: stored.contentInline ?? input.content,
            path: input.source ?? 'memory',
            sourceRole: 'unknown',
            summary,
            targetId: id,
            targetType: 'memory',
            updatedAt: createdAt,
        })
    })

    return {
        accepted: true,
        id,
        memoryIds: [id],
    }
}

export async function saveKonteksMemories(
    db: SqliteConnection,
    context: Project,
    input: SaveMemoriesInput,
    _options: SaveOptions = {},
): Promise<SaveResult> {
    const batchId = `memory_batch_${randomUUID()}`
    const memoryIds: string[] = []
    let skippedMemories = 0

    await withTransaction(db, async tx => {
        for (const memory of input.memories) {
            try {
                const saved = await saveKonteksMemory(tx, context, memory)
                memoryIds.push(saved.id)
            } catch (error) {
                if (!isSkippableMemoryError(error)) {
                    throw error
                }
                skippedMemories += 1
            }
        }
    })

    return {
        accepted: true,
        id: memoryIds[0] ?? batchId,
        memoryIds: [...new Set(memoryIds)],
        skippedMemories,
    }
}

export async function saveKonteksSession(
    db: SqliteConnection,
    context: Project,
    input: SaveSessionInput,
    _options: SaveOptions = {},
): Promise<SaveResult> {
    validateSessionQuality(input.summary)
    const id = `diary_${randomUUID()}`
    const payload = JSON.stringify(input, null, 2)
    const stored = await storePayload(payload, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const createdAt = new Date().toISOString()

    await withTransaction(db, async () => {
        await insertDiaryEntry({
            contentHash: stored.contentHash,
            createdAt,
            id,
            payloadRef: stored.payloadRef ?? null,
            subject: input.task,
            summary: input.summary,
            tagsJson: JSON.stringify([input.status]),
        })

        await appendMemoryEvent({
            actor: 'mcp',
            eventType: 'diary_entry_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'diary_entry',
            summary: input.summary,
        })

        await indexSearchDocument({
            content: input.summary,
            createdAt,
            id,
            kind: 'diary',
            task: input.task,
            type: 'diary',
        })
    })

    return {
        accepted: true,
        id,
    }
}

export async function saveKonteksDiary(
    db: SqliteConnection,
    context: Project,
    input: SaveDiaryInput,
    options: SaveOptions = {},
): Promise<SaveResult> {
    const formattedInput = withProjectUpdateSummary(
        input,
        options.projectUpdate,
    )
    validateSessionQuality(formattedInput.summary)
    const id = `diary_${randomUUID()}`
    const tags = formattedInput.tags?.length
        ? formattedInput.tags.join(', ')
        : ''
    const text = [formattedInput.subject, formattedInput.summary, tags]
        .filter(Boolean)
        .join('\n')
    const stored = await storePayload(text, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const createdAt = new Date().toISOString()

    await withTransaction(db, async () => {
        await insertDiaryEntry({
            contentHash: stored.contentHash,
            createdAt,
            id,
            payloadRef: stored.payloadRef ?? null,
            subject: formattedInput.subject ?? null,
            summary: formattedInput.summary,
            tagsJson: JSON.stringify(formattedInput.tags ?? []),
        })

        await appendMemoryEvent({
            actor: 'mcp',
            eventType: 'diary_entry_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'diary_entry',
            summary: formattedInput.summary,
        })

        await indexSearchDocument({
            content: text,
            createdAt,
            id,
            kind: 'diary',
            type: 'diary',
        })
        await upsertRetrievalDocument({
            anchor: formattedInput.subject ?? id,
            embeddingText: text,
            ftsText: text,
            path: 'diary',
            sourceRole: 'unknown',
            summary: formattedInput.summary,
            targetId: id,
            targetType: 'diary',
            updatedAt: createdAt,
        })
    })

    return {
        accepted: true,
        diaryId: id,
        id,
    }
}

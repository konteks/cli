import { randomUUID } from 'node:crypto'
import type {
    SaveDiaryInput,
    SaveMemoriesInput,
    SaveMemoryInput,
    SaveOptions,
    SaveSessionInput,
} from '@/contracts/repositories/memory-repository'
import type { SaveResult as PublicSaveResult } from '@/models/memory'
import type { Project } from '@/models/project'
import { contentHash } from '@/providers/persistence/objects/content'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import storePayload from '@/providers/persistence/objects/store-payload'
import { upsertRetrievalDocument } from '@/providers/persistence/sqlite/retrieval-documents'
import type DatabaseService from './database-service'
import {
    importanceToConfidence,
    isSkippableMemoryError,
    summarizeText,
    validateMemoryQuality,
    validateSessionQuality,
    withProjectUpdateSummary,
} from './save-policy'
import { indexSearchDocument } from './search-index'

type SaveResult = PublicSaveResult & {
    accepted: true
    type: 'diary' | 'memories' | 'memory' | 'session'
}

export async function saveKonteksMemory(
    db: DatabaseService,
    context: Project,
    input: SaveMemoryInput,
    options: SaveOptions = {},
): Promise<SaveResult> {
    return await persistMemory(db, context, input, options)
}

export async function saveKonteksMemories(
    db: DatabaseService,
    context: Project,
    input: SaveMemoriesInput,
    options: SaveOptions = {},
): Promise<SaveResult> {
    return await persistMemories(db, context, input, options)
}

export async function saveKonteksDiary(
    db: DatabaseService,
    context: Project,
    input: SaveDiaryInput,
    options: SaveOptions = {},
): Promise<SaveResult> {
    return await persistDiary(db, context, input, options)
}

export async function saveKonteksSession(
    db: DatabaseService,
    context: Project,
    input: SaveSessionInput,
    options: SaveOptions = {},
): Promise<SaveResult> {
    return await persistSession(db, context, input, options)
}

async function persistMemories(
    db: DatabaseService,
    context: Project,
    input: SaveMemoriesInput,
    _options: SaveOptions = {},
): Promise<SaveResult> {
    const batchId = `memory_batch_${randomUUID()}`
    const memoryIds: string[] = []
    let skippedMemories = 0

    await db.transaction(async tx => {
        for (const memory of input.memories) {
            try {
                const saved = await persistMemory(tx, context, memory)
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
        type: 'memories',
    }
}

async function persistMemory(
    db: DatabaseService,
    context: Project,
    input: SaveMemoryInput,
    _options: SaveOptions = {},
): Promise<SaveResult> {
    validateMemoryQuality(input.content)
    const hash = contentHash(input.content)
    const duplicate = await findDuplicateObservation(db, hash)
    if (duplicate) {
        return {
            accepted: true,
            duplicateOf: duplicate.id,
            id: duplicate.id,
            memoryIds: [duplicate.id],
            type: 'memory',
        }
    }

    const id = `obs_${randomUUID()}`
    const stored = await storePayload(input.content, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const summary = summarizeText(input.content)
    const createdAt = new Date().toISOString()

    await db.transaction(async tx => {
        await tx.adapter.execute(
            `
insert into observations (
    id,
    kind,
    text_inline,
    payload_ref,
    content_hash,
    confidence,
    created_at
) values (?, ?, ?, ?, ?, ?, ?)
`,
            [
                id,
                input.kind,
                stored.contentInline ?? summary,
                stored.payloadRef ?? null,
                stored.contentHash,
                importanceToConfidence(input.importance),
                createdAt,
            ],
        )

        await tx.events.append({
            actor: 'mcp',
            eventType: 'memory_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'observation',
            summary,
        })

        await indexSearchDocument(tx.adapter, {
            content: stored.contentInline ?? summary,
            createdAt,
            id,
            kind: input.kind,
            type: 'memory',
        })
        await upsertRetrievalDocument(tx, {
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
        type: 'memory',
    }
}

async function persistSession(
    db: DatabaseService,
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

    await db.transaction(async tx => {
        await tx.adapter.execute(
            `
insert into diary_entries (
    id,
    subject,
    summary,
    tags_json,
    payload_ref,
    content_hash,
    created_at
) values (?, ?, ?, ?, ?, ?, ?)
`,
            [
                id,
                input.task,
                input.summary,
                JSON.stringify([input.status]),
                stored.payloadRef ?? null,
                stored.contentHash,
                createdAt,
            ],
        )

        await tx.events.append({
            actor: 'mcp',
            eventType: 'diary_entry_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'diary_entry',
            summary: input.summary,
        })

        await indexSearchDocument(tx.adapter, {
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
        type: 'session',
    }
}

async function persistDiary(
    db: DatabaseService,
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

    await db.transaction(async tx => {
        await tx.adapter.execute(
            `
insert into diary_entries (
    id,
    subject,
    summary,
    tags_json,
    payload_ref,
    content_hash,
    created_at
) values (?, ?, ?, ?, ?, ?, ?)
`,
            [
                id,
                formattedInput.subject ?? null,
                formattedInput.summary,
                JSON.stringify(formattedInput.tags ?? []),
                stored.payloadRef ?? null,
                stored.contentHash,
                createdAt,
            ],
        )

        await tx.events.append({
            actor: 'mcp',
            eventType: 'diary_entry_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'diary_entry',
            summary: formattedInput.summary,
        })

        await indexSearchDocument(tx.adapter, {
            content: text,
            createdAt,
            id,
            kind: 'diary',
            type: 'diary',
        })
        await upsertRetrievalDocument(tx, {
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
        type: 'diary',
    }
}

async function findDuplicateObservation(
    db: DatabaseService,
    hash: string,
): Promise<{ id: string } | undefined> {
    const rows = await db.adapter.query<{ id: string }>(
        `
select id
from observations
where content_hash = ?
  and deleted_at is null
  and suppressed_at is null
limit 1
`,
        [hash],
    )

    return rows[0]
}

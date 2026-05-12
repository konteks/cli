import { randomUUID } from 'node:crypto'
import type {
    SaveInput,
    SaveOptions,
} from '@/app/contracts/repositories/memory-repository'
import type { SaveResult as PublicSaveResult } from '@/app/models/memory'
import type { Project } from '@/app/models/project'
import { contentHash } from '@/app/providers/persistence/objects/content'
import { storePayload } from '@/app/providers/persistence/objects/payload'
import { createToonStore } from '@/app/providers/persistence/objects/toon-store'
import { upsertRetrievalDocument } from '@/app/providers/persistence/sqlite/retrieval-documents'
import type { DatabaseService } from './db'
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
    type: SaveInput['type']
}

export async function saveKonteksInput(
    db: DatabaseService,
    context: Project,
    input: SaveInput,
    options: SaveOptions = {},
): Promise<SaveResult> {
    if (input.type === 'memory') {
        return saveMemory(db, context, input)
    }

    if (input.type === 'memories') {
        return saveMemories(db, context, input)
    }

    if (input.type === 'diary') {
        return saveDiary(
            db,
            context,
            withProjectUpdateSummary(input, options.projectUpdate),
        )
    }

    return saveSession(db, context, input)
}

async function saveMemories(
    db: DatabaseService,
    context: Project,
    input: Extract<SaveInput, { type: 'memories' }>,
): Promise<SaveResult> {
    const batchId = `memory_batch_${randomUUID()}`
    const memoryIds: string[] = []
    let skippedMemories = 0

    await db.transaction(async tx => {
        for (const memory of input.memories) {
            try {
                const saved = await saveMemory(tx, context, memory)
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
        type: input.type,
    }
}

async function saveMemory(
    db: DatabaseService,
    context: Project,
    input: Extract<SaveInput, { type: 'memory' }>,
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
            type: input.type,
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
        type: input.type,
    }
}

async function saveSession(
    db: DatabaseService,
    context: Project,
    input: Extract<SaveInput, { type: 'session' }>,
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
        type: input.type,
    }
}

async function saveDiary(
    db: DatabaseService,
    context: Project,
    input: Extract<SaveInput, { type: 'diary' }>,
): Promise<SaveResult> {
    validateSessionQuality(input.summary)
    const id = `diary_${randomUUID()}`
    const tags = input.tags?.length ? input.tags.join(', ') : ''
    const text = [input.subject, input.summary, tags].filter(Boolean).join('\n')
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
                input.subject ?? null,
                input.summary,
                JSON.stringify(input.tags ?? []),
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
            content: text,
            createdAt,
            id,
            kind: 'diary',
            type: 'diary',
        })
        await upsertRetrievalDocument(tx, {
            anchor: input.subject ?? id,
            embeddingText: text,
            ftsText: text,
            path: 'diary',
            sourceRole: 'unknown',
            summary: input.summary,
            targetId: id,
            targetType: 'diary',
            updatedAt: createdAt,
        })
    })

    return {
        accepted: true,
        id,
        type: input.type,
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

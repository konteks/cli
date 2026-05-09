import { randomUUID } from 'node:crypto'
import { upsertRetrievalDocument } from '../mining/retrieval-documents.js'
import type { LoadedProjectContext } from '../project/context.js'
import { contentHash } from '../storage/content.js'
import { appendMemoryEvent } from '../storage/event-log.js'
import { storePayload } from '../storage/payload.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import { createToonStore } from '../storage/toon-store.js'
import { indexSearchDocument } from './search-index.js'

type SaveResult = {
    accepted: true
    duplicateOf?: string
    diaryId?: string
    id: string
    memoryIds?: string[]
    skippedMemories?: number
    type: SaveStoreInput['type']
}

type MemoryKind =
    | 'blocker'
    | 'code_insight'
    | 'constraint'
    | 'decision'
    | 'fact'
    | 'note'
    | 'preference'

type SaveMemoryInput = {
    content: string
    entities?: string[]
    importance?: 1 | 2 | 3 | 4 | 5
    kind: MemoryKind
    source?: string
    tags?: string[]
    type: 'memory'
}

type SaveStoreInput =
    | SaveMemoryInput
    | {
          memories: SaveMemoryInput[]
          type: 'memories'
      }
    | {
          subject?: string
          summary: string
          tags?: string[]
          type: 'diary'
      }
    | {
          blockers?: string[]
          decisions?: string[]
          entities?: string[]
          filesTouched?: string[]
          nextSteps?: string[]
          openQuestions?: string[]
          status: 'blocked' | 'done' | 'partial'
          summary: string
          task: string
          testsRun?: string[]
          type: 'session'
      }

export type SaveProjectUpdate = {
    deletedFilePaths: string[]
    updatedFilePaths: string[]
}

export async function saveKonteksInput(
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    input: SaveStoreInput,
    options: { projectUpdate?: SaveProjectUpdate } = {},
): Promise<SaveResult> {
    if (input.type === 'memory') {
        return saveMemory(adapter, context, input)
    }

    if (input.type === 'memories') {
        return saveMemories(adapter, context, input)
    }

    if (input.type === 'diary') {
        return saveDiary(
            adapter,
            context,
            withProjectUpdateSummary(input, options.projectUpdate),
        )
    }

    return saveSession(adapter, context, input)
}

async function saveMemories(
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    input: Extract<SaveStoreInput, { type: 'memories' }>,
): Promise<SaveResult> {
    const batchId = `memory_batch_${randomUUID()}`
    const memoryIds: string[] = []
    let skippedMemories = 0

    await adapter.transaction(async () => {
        for (const memory of input.memories) {
            try {
                const saved = await saveMemory(adapter, context, memory)
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
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    input: Extract<SaveStoreInput, { type: 'memory' }>,
): Promise<SaveResult> {
    validateMemoryQuality(input.content)
    const hash = contentHash(input.content)
    const duplicate = await findDuplicateObservation(adapter, hash)
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

    await adapter.transaction(async () => {
        await adapter.execute(
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
        await appendMemoryEvent(adapter, {
            actor: 'mcp',
            eventType: 'memory_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'observation',
            summary,
        })
        await indexSearchDocument(adapter, {
            content: stored.contentInline ?? summary,
            createdAt,
            id,
            kind: input.kind,
            type: 'memory',
        })
        await upsertRetrievalDocument(adapter, {
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
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    input: Extract<SaveStoreInput, { type: 'session' }>,
): Promise<SaveResult> {
    validateSessionQuality(input.summary)
    const id = `diary_${randomUUID()}`
    const payload = JSON.stringify(input, null, 2)
    const stored = await storePayload(payload, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const createdAt = new Date().toISOString()

    await adapter.transaction(async () => {
        await adapter.execute(
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
        await appendMemoryEvent(adapter, {
            actor: 'mcp',
            eventType: 'diary_entry_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'diary_entry',
            summary: input.summary,
        })
        await indexSearchDocument(adapter, {
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
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    input: Extract<SaveStoreInput, { type: 'diary' }>,
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

    await adapter.transaction(async () => {
        await adapter.execute(
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
        await appendMemoryEvent(adapter, {
            actor: 'mcp',
            eventType: 'diary_entry_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'diary_entry',
            summary: input.summary,
        })
        await indexSearchDocument(adapter, {
            content: text,
            createdAt,
            id,
            kind: 'diary',
            type: 'diary',
        })
        await upsertRetrievalDocument(adapter, {
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

function summarizeText(content: string): string {
    const normalized = content.trim().replaceAll(/\s+/gu, ' ')
    return normalized.length > 240
        ? `${normalized.slice(0, 237).trimEnd()}...`
        : normalized
}

function importanceToConfidence(importance: number | undefined): number {
    return importance ? importance / 5 : 1
}

async function findDuplicateObservation(
    adapter: SqliteAdapter,
    hash: string,
): Promise<{ id: string } | undefined> {
    const rows = await adapter.query<{ id: string }>(
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

function validateMemoryQuality(content: string): void {
    const normalized = content.trim()
    if (looksSensitive(normalized)) {
        throw new Error('memory content appears to contain a secret')
    }
    if (normalized.split(/\s+/u).filter(Boolean).length < 4) {
        throw new Error('memory content is too short to save')
    }
}

function validateSessionQuality(summary: string): void {
    if (summary.trim().split(/\s+/u).filter(Boolean).length < 4) {
        throw new Error('session summary is too short to save')
    }
}

function withProjectUpdateSummary(
    input: Extract<SaveStoreInput, { type: 'diary' }>,
    projectUpdate: SaveProjectUpdate | undefined,
): Extract<SaveStoreInput, { type: 'diary' }> {
    const projectSummary = summarizeProjectUpdate(projectUpdate)
    if (!projectSummary) {
        return input
    }

    return {
        ...input,
        summary: `${input.summary}\n${projectSummary}`,
    }
}

function summarizeProjectUpdate(
    projectUpdate: SaveProjectUpdate | undefined,
): string {
    if (!projectUpdate) {
        return ''
    }

    const updated = projectUpdate.updatedFilePaths.slice(0, 8)
    const deleted = projectUpdate.deletedFilePaths.slice(0, 8)
    const lines: string[] = []

    if (updated.length > 0) {
        lines.push(`Updated project files considered: ${updated.join(', ')}`)
    }
    if (deleted.length > 0) {
        lines.push(`Deleted project files considered: ${deleted.join(', ')}`)
    }

    return lines.join('\n')
}

function isSkippableMemoryError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.message.includes('too short') ||
            error.message.includes('secret'))
    )
}

function looksSensitive(content: string): boolean {
    return /(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/iu.test(
        content,
    )
}

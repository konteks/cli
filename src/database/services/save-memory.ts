import { randomUUID } from 'node:crypto'
import { withTransaction } from '@/database/actions/_db'
import appendMemoryEvent from '@/database/actions/append-memory-event'
import findDuplicateObservation from '@/database/actions/find-duplicate-observation'
import indexSearchDocument from '@/database/actions/index-search-document'
import insertDiaryEntry from '@/database/actions/insert-diary-entry'
import insertObservation from '@/database/actions/insert-observation'
import upsertRetrievalDocument from '@/database/actions/upsert-retrieval-document'
import {
    importanceToConfidence,
    isSkippableMemoryError,
    summarizeText,
    validateMemoryQuality,
    validateSessionQuality,
    withProjectUpdateSummary,
} from '@/database/support/save-policy'
import { generateEmbeddingsForTargets } from '@/modules/embeddings/generate-target-embeddings'
import HuggingFaceEmbeddingProvider from '@/modules/embeddings/hugging-face-embedding-provider'
import { contentHash } from '@/modules/persistence/objects/content'
import createToonStore from '@/modules/persistence/objects/create-toon-store'
import storePayload from '@/modules/persistence/objects/store-payload'
import type { EmbeddingProviderContract } from '@/types/embedding-provider'
import type { ObservationKind, SaveResult } from '@/types/memory'
import type { Project } from '@/types/project'

type SaveMemoryInput = {
    content: string
    kind: ObservationKind
    importance: 1 | 2 | 3 | 4 | 5
    source?: string
    tags?: string[]
}

export type SaveDiaryInput = {
    subject?: string
    summary: string
    tags?: string[]
}

export type SaveMemoriesInput = {
    memories: SaveMemoryInput[]
}

export type SaveOptions = {
    embeddingProvider?: EmbeddingProviderContract
    projectUpdate?: {
        deletedFilePaths: string[]
        updatedFilePaths: string[]
    }
}

type MemoryWriteResult = SaveResult & {
    createdAt?: string
    newTargetId?: string
}

type SaveMemoryOptions = SaveOptions & {
    embedAfterSave?: boolean
}

async function saveKonteksMemory(
    context: Project,
    input: SaveMemoryInput,
    options: SaveMemoryOptions = {},
): Promise<MemoryWriteResult> {
    validateMemoryQuality(input.content)
    const hash = contentHash(input.content)
    const duplicate = await withTransaction(() =>
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

    await withTransaction(async () => {
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

    if (options.embedAfterSave !== false) {
        await embedSavedTargets(options.embeddingProvider, createdAt, [
            { targetId: id, targetType: 'memory' },
        ])
    }

    return {
        accepted: true,
        createdAt,
        id,
        memoryIds: [id],
        newTargetId: id,
    }
}

export async function saveKonteksMemories(
    context: Project,
    input: SaveMemoriesInput,
    _options: SaveOptions = {},
): Promise<SaveResult> {
    const batchId = `memory_batch_${randomUUID()}`
    const memoryIds: string[] = []
    const newTargets: Array<{ targetId: string; targetType: 'memory' }> = []
    let skippedMemories = 0

    await withTransaction(async () => {
        for (const memory of input.memories) {
            try {
                const saved = await saveKonteksMemory(context, memory, {
                    ..._options,
                    embedAfterSave: false,
                })
                memoryIds.push(saved.id)
                if (saved.newTargetId) {
                    newTargets.push({
                        targetId: saved.newTargetId,
                        targetType: 'memory',
                    })
                }
            } catch (error) {
                if (!isSkippableMemoryError(error)) {
                    throw error
                }
                skippedMemories += 1
            }
        }
    })

    if (newTargets.length > 0) {
        await embedSavedTargets(
            _options.embeddingProvider,
            new Date().toISOString(),
            newTargets,
        )
    }

    return {
        accepted: true,
        id: memoryIds[0] ?? batchId,
        memoryIds: [...new Set(memoryIds)],
        skippedMemories,
    }
}

export async function saveKonteksDiary(
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

    await withTransaction(async () => {
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

    await embedSavedTargets(options.embeddingProvider, createdAt, [
        { targetId: id, targetType: 'diary' },
    ])

    return {
        accepted: true,
        diaryId: id,
        id,
    }
}

async function embedSavedTargets(
    provider: EmbeddingProviderContract | undefined,
    createdAt: string,
    targets: Array<{ targetId: string; targetType: 'diary' | 'memory' }>,
): Promise<void> {
    if (targets.length === 0) {
        return
    }

    try {
        await generateEmbeddingsForTargets(
            provider ?? new HuggingFaceEmbeddingProvider(),
            targets,
            createdAt,
        )
    } catch {
        // Durable save succeeded; embedding is a best-effort retrieval index update.
    }
}

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
    | 'decision'
    | 'fact'
    | 'note'
    | 'preference'

export type SaveStoreInput =
    | {
          chat: string
          type: 'chat'
      }
    | {
          content: string
          entities?: string[]
          importance?: 1 | 2 | 3 | 4 | 5
          kind: MemoryKind
          source?: string
          tags?: string[]
          type: 'memory'
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
    if (input.type === 'chat') {
        return saveChat(adapter, context, input, options.projectUpdate)
    }

    if (input.type === 'memory') {
        return saveMemory(adapter, context, input)
    }

    if (input.type === 'diary') {
        return saveDiary(adapter, context, input)
    }

    return saveSession(adapter, context, input)
}

async function saveChat(
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    input: Extract<SaveStoreInput, { type: 'chat' }>,
    projectUpdate: SaveProjectUpdate | undefined,
): Promise<SaveResult> {
    validateChatQuality(input.chat)
    const candidates = extractMemoriesFromChat(input.chat)
    return adapter.transaction(async () => {
        const memoryIds: string[] = []
        let skippedMemories = 0

        for (const candidate of candidates) {
            try {
                const saved = await saveMemory(adapter, context, candidate)
                memoryIds.push(saved.id)
            } catch (error) {
                if (!isSkippableMemoryError(error)) {
                    throw error
                }
                skippedMemories += 1
            }
        }

        const diary = await saveDiary(adapter, context, {
            subject: inferDiarySubject(input.chat, candidates),
            summary: summarizeDiary(input.chat, candidates, projectUpdate),
            tags: inferDiaryTags(candidates, projectUpdate),
            type: 'diary',
        })

        return {
            accepted: true,
            diaryId: diary.id,
            id: diary.id,
            memoryIds: [...new Set(memoryIds)],
            skippedMemories,
            type: input.type,
        }
    })
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
        type: input.type,
    }
}

async function saveSession(
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    input: Extract<SaveStoreInput, { type: 'session' }>,
): Promise<SaveResult> {
    validateSessionQuality(input.summary)
    const id = `handoff_${randomUUID()}`
    const payload = JSON.stringify(input, null, 2)
    const stored = await storePayload(payload, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const createdAt = new Date().toISOString()

    await adapter.transaction(async () => {
        await adapter.execute(
            `
insert into session_handoffs (
    id,
    session_id,
    task,
    status,
    summary,
    payload_ref,
    content_hash,
    created_at
) values (?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                id,
                null,
                input.task,
                input.status,
                input.summary,
                stored.payloadRef ?? null,
                stored.contentHash,
                createdAt,
            ],
        )
        await appendMemoryEvent(adapter, {
            actor: 'mcp',
            eventType: 'session_handoff_saved',
            id: `event_${randomUUID()}`,
            payloadRef: stored.payloadRef,
            subjectId: id,
            subjectType: 'session_handoff',
            summary: input.summary,
        })
        await indexSearchDocument(adapter, {
            content: input.summary,
            createdAt,
            id,
            kind: input.status,
            task: input.task,
            type: 'session',
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

function validateChatQuality(chat: string): void {
    const normalized = chat.trim()
    if (looksSensitive(normalized)) {
        throw new Error('chat transcript appears to contain a secret')
    }
    if (chat.trim().split(/\s+/u).filter(Boolean).length < 8) {
        throw new Error('chat transcript is too short to save')
    }
}

function isSkippableMemoryError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.message.includes('too short') ||
            error.message.includes('secret'))
    )
}

function extractMemoriesFromChat(
    chat: string,
): Array<Extract<SaveStoreInput, { type: 'memory' }>> {
    const seen = new Set<string>()
    const candidates: Array<Extract<SaveStoreInput, { type: 'memory' }>> = []

    for (const line of splitChatLines(chat)) {
        const memory = classifyChatLine(line)
        if (!memory || looksSensitive(memory.content)) {
            continue
        }

        const key = `${memory.kind}:${memory.content.toLowerCase()}`
        if (seen.has(key)) {
            continue
        }

        seen.add(key)
        candidates.push(memory)
        if (candidates.length >= 12) {
            break
        }
    }

    return candidates
}

type ChatLine = {
    role: 'assistant' | 'developer' | 'system' | 'unknown' | 'user'
    text: string
}

function splitChatLines(chat: string): ChatLine[] {
    return chat
        .split(/\r?\n|(?<=[.!?])\s+/u)
        .map(parseChatLine)
        .filter(line => line.text.split(/\s+/u).length >= 4)
}

function parseChatLine(line: string): ChatLine {
    const match = /^(user|assistant|agent|system|developer)\s*:\s*(.*)$/iu.exec(
        line.trim(),
    )
    const role = normalizeChatRole(match?.[1])
    return {
        role,
        text: (match?.[2] ?? line).trim(),
    }
}

function normalizeChatRole(value: string | undefined): ChatLine['role'] {
    const normalized = value?.toLowerCase()
    if (normalized === 'agent') {
        return 'assistant'
    }
    if (
        normalized === 'assistant' ||
        normalized === 'developer' ||
        normalized === 'system' ||
        normalized === 'user'
    ) {
        return normalized
    }
    return 'unknown'
}

function classifyChatLine(
    line: ChatLine,
): Extract<SaveStoreInput, { type: 'memory' }> | undefined {
    const normalized = line.text.replaceAll(/\s+/gu, ' ').trim()
    const lower = normalized.toLowerCase()

    if (line.role === 'system' || line.role === 'developer') {
        return undefined
    }

    if (
        /\b(blocked|blocker|cannot|can't|failed|failing|error)\b/iu.test(
            lower,
        ) &&
        /\b(because|due to|on|in|when|after|while|during|from)\b/iu.test(lower)
    ) {
        return memoryCandidate('blocker', normalized, 4)
    }

    if (
        line.role === 'user' &&
        /\b(i prefer|i want|i don't want|do not|don't|prefer|avoid)\b/iu.test(
            lower,
        )
    ) {
        return memoryCandidate('preference', normalized, 5)
    }

    if (
        line.role === 'user' &&
        /\b(accepted|we agreed|we decided|decision:|final decision|must|shouldn't|should not)\b/iu.test(
            lower,
        )
    ) {
        return memoryCandidate('decision', normalized, 5)
    }

    if (
        line.role === 'assistant' &&
        /\b(implemented|patched|changed|updated|renamed|removed|added|verified)\b/iu.test(
            lower,
        ) &&
        /\b(done|implemented|patched|changed|updated|renamed|removed|added|verified|passed)\b/iu.test(
            lower,
        )
    ) {
        return memoryCandidate('code_insight', normalized, 4)
    }

    return undefined
}

function memoryCandidate(
    kind: Extract<SaveStoreInput, { type: 'memory' }>['kind'],
    content: string,
    importance: 1 | 2 | 3 | 4 | 5,
): Extract<SaveStoreInput, { type: 'memory' }> {
    return {
        content,
        importance,
        kind,
        source: 'session_chat',
        tags: ['session'],
        type: 'memory',
    }
}

function inferDiarySubject(
    chat: string,
    candidates: Array<Extract<SaveStoreInput, { type: 'memory' }>>,
): string {
    const firstDecision = candidates.find(item => item.kind === 'decision')
    const source =
        firstDecision?.content ?? splitChatLines(chat)[0]?.text ?? chat
    return summarizeText(source)
        .replace(/[.?!]$/u, '')
        .slice(0, 80)
}

function summarizeDiary(
    chat: string,
    candidates: Array<Extract<SaveStoreInput, { type: 'memory' }>>,
    projectUpdate: SaveProjectUpdate | undefined,
): string {
    const memorySummary = candidates
        .slice(0, 6)
        .map(item => `- ${item.content}`)
        .join('\n')
    const projectSummary = summarizeProjectUpdate(projectUpdate)

    const parts = ['Session saved from chat transcript.']
    if (memorySummary) {
        parts.push(`High-signal memories extracted:\n${memorySummary}`)
    } else {
        parts.push(`Summary: ${summarizeText(chat)}`)
    }
    if (projectSummary) {
        parts.push(projectSummary)
    }

    return parts.join('\n')
}

function inferDiaryTags(
    candidates: Array<Extract<SaveStoreInput, { type: 'memory' }>>,
    projectUpdate: SaveProjectUpdate | undefined,
): string[] {
    const tags = new Set(['session'])
    for (const candidate of candidates) {
        tags.add(candidate.kind)
    }
    if (
        (projectUpdate?.updatedFilePaths.length ?? 0) > 0 ||
        (projectUpdate?.deletedFilePaths.length ?? 0) > 0
    ) {
        tags.add('project_update')
    }
    return [...tags].slice(0, 8)
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

function looksSensitive(content: string): boolean {
    return /(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/iu.test(
        content,
    )
}

import { randomUUID } from 'node:crypto'
import type { SaveInput } from '../mcp/inputs.js'
import type { LoadedProjectContext } from '../project/context.js'
import { appendMemoryEvent } from '../storage/event-log.js'
import { storePayload } from '../storage/payload.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import { createToonStore } from '../storage/toon-store.js'

type SaveResult = {
    accepted: true
    id: string
    type: SaveInput['type']
}

export async function saveKonteksInput(
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    input: SaveInput,
): Promise<SaveResult> {
    if (input.type === 'memory') {
        return saveMemory(adapter, context, input)
    }

    return saveSession(adapter, context, input)
}

async function saveMemory(
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    input: Extract<SaveInput, { type: 'memory' }>,
): Promise<SaveResult> {
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
    confidence,
    created_at
) values (?, ?, ?, ?, ?, ?)
`,
            [
                id,
                input.kind,
                stored.contentInline ?? summary,
                stored.payloadRef ?? null,
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
    input: Extract<SaveInput, { type: 'session' }>,
): Promise<SaveResult> {
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
    created_at
) values (?, ?, ?, ?, ?, ?, ?)
`,
            [
                id,
                null,
                input.task,
                input.status,
                input.summary,
                stored.payloadRef ?? null,
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

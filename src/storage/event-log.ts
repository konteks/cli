import type { SqliteAdapter } from './sqlite-adapter.js'

type MemoryEventInput = {
    actor?: string
    eventType: string
    id: string
    payloadRef?: string
    sourceId?: string
    subjectId?: string
    subjectType: string
    summary: string
}

export async function appendMemoryEvent(
    adapter: SqliteAdapter,
    event: MemoryEventInput,
): Promise<void> {
    await adapter.execute(
        `
insert into memory_events (
    id,
    event_type,
    subject_type,
    subject_id,
    source_id,
    summary,
    payload_ref,
    actor,
    created_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
        [
            event.id,
            event.eventType,
            event.subjectType,
            event.subjectId ?? null,
            event.sourceId ?? null,
            event.summary,
            event.payloadRef ?? null,
            event.actor ?? null,
            new Date().toISOString(),
        ],
    )
}

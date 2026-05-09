import { memoryEvents } from './schema.js'
import type { KonteksDatabase } from './sqlite-adapter.js'

export type MemoryEventInput = {
    actor?: string
    eventType: string
    id: string
    payloadRef?: string
    sourceId?: string
    subjectId?: string
    subjectType: string
    summary: string
}

export class EventLogStore {
    constructor(private readonly db: KonteksDatabase) {}

    async append(event: MemoryEventInput): Promise<void> {
        await this.db.insert(memoryEvents).values({
            actor: event.actor ?? null,
            createdAt: new Date().toISOString(),
            eventType: event.eventType,
            id: event.id,
            payloadRef: event.payloadRef ?? null,
            sourceId: event.sourceId ?? null,
            subjectId: event.subjectId ?? null,
            subjectType: event.subjectType,
            summary: event.summary,
        })
    }
}

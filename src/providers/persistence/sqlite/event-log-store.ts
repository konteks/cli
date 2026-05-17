import { memoryEvents } from './schema'
import type { KonteksDatabase } from './sqlite-adapter'

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

export default class EventLogStore {
    public constructor(private readonly db: KonteksDatabase) {}

    public async append(event: MemoryEventInput): Promise<void> {
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

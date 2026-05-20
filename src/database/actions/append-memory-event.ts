import { memoryEvents } from '@/database/schema'
import getDb from './_db'

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

export default async function appendMemoryEvent(
    event: MemoryEventInput,
): Promise<void> {
    const db = await getDb()
    await db.insert(memoryEvents).values({
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

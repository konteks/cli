import { describe, expect, it } from 'bun:test'
import EventLogStore from '@/providers/persistence/sqlite/event-log-store'
import type { KonteksDatabase } from '@/providers/persistence/sqlite/libsql-helpers'

type MemoryEvent = {
    actor: string
    eventType: string
    id: string
    subjectId: string
    subjectType: string
    summary: string
}

describe('event log', () => {
    it('inserts memory events with drizzle', async () => {
        const inserted: MemoryEvent[] = []
        const db = {
            insert: () => ({
                values: (val: MemoryEvent) => {
                    inserted.push(val)
                },
            }),
        } as unknown as KonteksDatabase

        const store = new EventLogStore(db)

        await store.append({
            actor: 'test',
            eventType: 'memory_saved',
            id: 'event_1',
            subjectId: 'memory_1',
            subjectType: 'memory',
            summary: 'Saved test memory',
        })

        expect(inserted).toHaveLength(1)
        expect(inserted[0].eventType).toBe('memory_saved')
        expect(inserted[0].summary).toBe('Saved test memory')
    })
})

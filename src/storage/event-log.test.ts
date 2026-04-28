import { describe, expect, it } from 'bun:test'
import { appendMemoryEvent } from './event-log.js'
import type { SqliteAdapter, SqliteParams } from './sqlite-adapter.js'

describe('event log', () => {
    it('inserts memory events with chronology metadata', async () => {
        const executed: Array<{ params?: SqliteParams; sql: string }> = []
        const adapter: SqliteAdapter = {
            async execute(sql, params) {
                executed.push({ params, sql })
            },
            async query() {
                return []
            },
            async transaction(operation) {
                return operation()
            },
        }

        await appendMemoryEvent(adapter, {
            actor: 'test',
            eventType: 'memory_saved',
            id: 'event_1',
            subjectId: 'memory_1',
            subjectType: 'memory',
            summary: 'Saved test memory',
        })

        expect(executed).toHaveLength(1)
        expect(executed[0]?.sql).toContain('insert into memory_events')
        expect(executed[0]?.params).toContain('memory_saved')
        expect(executed[0]?.params).toContain('Saved test memory')
    })
})

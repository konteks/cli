import { describe, expect, it } from 'bun:test'
import runMigrations from '@/providers/persistence/sqlite/run-migrations'
import type {
    SqliteAdapter,
    SqliteParams,
} from '@/providers/persistence/sqlite/sqlite-adapter'

describe('migrations', () => {
    it('runs unapplied migrations through an adapter transaction', async () => {
        const executed: Array<{ params?: SqliteParams; sql: string }> = []
        const adapter: SqliteAdapter = {
            async close() {},
            async execute(sql, params) {
                executed.push({ params, sql })
            },
            async query() {
                return []
            },
            async queryArrays() {
                return []
            },
            async transaction(operation) {
                return operation()
            },
        }

        await runMigrations(adapter)

        expect(
            executed.some(item => item.sql.includes('schema_migrations')),
        ).toBe(true)
        expect(executed.some(item => item.sql.includes('memory_events'))).toBe(
            true,
        )
        expect(
            executed.some(item =>
                item.sql.includes('insert into schema_migrations'),
            ),
        ).toBe(true)
    })
})

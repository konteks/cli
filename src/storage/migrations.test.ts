import { describe, expect, it } from 'bun:test'
import { migrations, runMigrations } from './migrations.js'
import type { SqliteAdapter, SqliteParams } from './sqlite-adapter.js'

describe('migrations', () => {
    it('defines the initial schema migration', () => {
        expect(migrations.map(migration => migration.id)).toEqual([
            '001_initial_schema',
            '002_memory_hygiene',
        ])
    })

    it('adds memory hygiene metadata', () => {
        const sql = migrations[1]?.sql ?? ''

        expect(sql).toContain('observations add column content_hash')
        expect(sql).toContain('chunks add column deleted_at')
        expect(sql).toContain('session_handoffs add column forget_reason')
    })

    it('creates the core memory tables', () => {
        const sql = migrations[0]?.sql ?? ''

        for (const table of [
            'sources',
            'chunks',
            'entities',
            'relations',
            'observations',
            'sessions',
            'session_handoffs',
            'memory_events',
            'taxonomy_nodes',
            'taxonomy_links',
        ]) {
            expect(sql).toContain(`create table if not exists ${table}`)
        }
    })

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

import { describe, expect, it } from 'bun:test'
import { migrations, runMigrations } from './migrations'
import type { SqliteAdapter, SqliteParams } from './sqlite-adapter'

describe('migrations', () => {
    it('defines the squashed initial schema migration', () => {
        expect(migrations.map(migration => migration.id)).toEqual([
            '001_initial_schema',
        ])
    })

    it('creates the core memory tables in the squashed migration', () => {
        const sql = migrations[0]?.sql ?? ''

        for (const table of [
            'sources',
            'chunks',
            'entities',
            'relations',
            'observations',
            'memory_events',
            'taxonomy_nodes',
            'taxonomy_links',
            'diary_entries',
            'retrieval_documents',
            'modules',
            'memory_fts',
        ]) {
            expect(sql).toContain(`create table if not exists ${table}`)
        }

        // Verify unused tables are removed
        expect(sql).not.toContain('create table if not exists sessions')
        expect(sql).not.toContain('create table if not exists session_events')
        expect(sql).not.toContain('create table if not exists session_handoffs')
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

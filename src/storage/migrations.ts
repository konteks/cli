import initialSchemaSql from './migrations/001_initial_schema.sql'
import type { SqliteAdapter } from './sqlite-adapter.js'

type Migration = {
    id: string
    sql: string
}

export const migrations: Migration[] = [
    {
        id: '001_initial_schema',
        sql: initialSchemaSql,
    },
]

export async function runMigrations(adapter: SqliteAdapter): Promise<void> {
    await adapter.transaction(async () => {
        await adapter.execute(`
create table if not exists schema_migrations (
    id text primary key,
    applied_at text not null
);
`)

        const applied = new Set(
            (
                await adapter.query<{ id: string }>(
                    'select id from schema_migrations',
                )
            ).map(row => row.id),
        )

        for (const migration of migrations) {
            if (applied.has(migration.id)) {
                continue
            }

            await adapter.execute(migration.sql)
            await adapter.execute(
                'insert into schema_migrations (id, applied_at) values (?, ?)',
                [migration.id, new Date().toISOString()],
            )
        }
    })
}

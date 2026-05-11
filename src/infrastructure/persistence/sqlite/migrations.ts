import { readFile } from '@/services/file-manager'
import type { SqliteAdapter } from './sqlite-adapter'

type Migration = {
    id: string
    sql: string
}

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

        const initialSchemaSql = await readFile(
            'src/infrastructure/persistence/sqlite/migrations/001_initial_schema.sql',
            'utf-8',
        )

        const migrations: Migration[] = [
            {
                id: '001_initial_schema',
                sql: initialSchemaSql,
            },
        ]

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

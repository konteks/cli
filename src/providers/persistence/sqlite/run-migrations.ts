import { type SqliteConnection, withTransaction } from './database'
import { executeSql, querySql } from './libsql-helpers'
import initialSchemaSql from './migrations/001_initial_schema.sql?raw'

type Migration = {
    id: string
    sql: string
}

const migrations: Migration[] = [
    {
        id: '001_initial_schema',
        sql: initialSchemaSql,
    },
]

export default async function runMigrations(
    service: SqliteConnection,
): Promise<void> {
    await withTransaction(service, async tx => {
        await executeSql(
            tx.client,
            `
create table if not exists schema_migrations (
    id text primary key,
    applied_at text not null
);
`,
        )

        const applied = new Set(
            (
                await querySql<{ id: string }>(
                    tx.client,
                    'select id from schema_migrations',
                )
            ).map(row => row.id),
        )

        for (const migration of migrations) {
            if (applied.has(migration.id)) {
                continue
            }

            await tx.client.executeMultiple(migration.sql)
            await executeSql(
                tx.client,
                'insert into schema_migrations (id, applied_at) values (?, ?)',
                [migration.id, new Date().toISOString()],
            )
        }
    })
}

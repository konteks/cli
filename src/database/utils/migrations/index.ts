import type { Client } from '@libsql/client'
import { sql } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type * as schema from '@/database/schema'
import initialSchemaSql from './001_initial_schema.sql?raw'
import aliasEntityIndexSql from './002_alias_entity_index.sql?raw'
import vectorIndexEntriesSql from './003_vector_index_entries.sql?raw'

type ProjectDatabase = LibSQLDatabase<typeof schema>

const MIGRATIONS: readonly {
    id: string
    sql: string
}[] = [
    {
        id: '001_initial_schema',
        sql: initialSchemaSql,
    },
    {
        id: '002_alias_entity_index',
        sql: aliasEntityIndexSql,
    },
    {
        id: '003_vector_index_entries',
        sql: vectorIndexEntriesSql,
    },
]

export default async function runMigrations(
    client: Client,
    db: ProjectDatabase,
): Promise<void> {
    await db.run(sql`
create table if not exists schema_migrations (
    id text primary key,
    applied_at text not null
);
`)

    const applied = new Set(
        (
            await db.all<{ id: string }>(sql`select id from schema_migrations`)
        ).map(row => row.id),
    )

    for (const migration of MIGRATIONS) {
        if (applied.has(migration.id)) {
            continue
        }

        await client.executeMultiple(migration.sql)
        await db.run(
            sql`insert into schema_migrations (id, applied_at) values (${migration.id}, ${new Date().toISOString()})`,
        )
    }
}

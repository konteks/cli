import type { SqliteAdapter } from './sqlite-adapter.js'

type Migration = {
    id: string
    sql: string
}

export const migrations: Migration[] = [
    {
        id: '001_initial_schema',
        sql: `
create table if not exists sources (
    id text primary key,
    type text not null,
    uri text,
    excerpt_ref text,
    created_at text not null
);

create table if not exists chunks (
    id text primary key,
    source_id text,
    kind text not null,
    path text,
    symbol text,
    summary text,
    content_inline text,
    payload_ref text,
    content_hash text not null,
    token_count integer not null default 0,
    created_at text not null,
    updated_at text not null,
    foreign key (source_id) references sources(id)
);

create table if not exists embeddings (
    chunk_id text primary key,
    provider text not null,
    model text not null,
    dimensions integer not null,
    vector_ref text not null,
    created_at text not null,
    foreign key (chunk_id) references chunks(id)
);

create table if not exists entities (
    id text primary key,
    type text not null,
    name text not null,
    canonical_name text not null,
    summary text,
    properties_json text,
    created_at text not null,
    updated_at text not null
);

create table if not exists entity_aliases (
    id text primary key,
    entity_id text not null,
    value text not null,
    normalized_value text not null,
    created_at text not null,
    foreign key (entity_id) references entities(id)
);

create table if not exists relations (
    id text primary key,
    subject_id text not null,
    predicate text not null,
    object_id text not null,
    confidence real not null default 1,
    status text not null default 'active',
    valid_from text,
    valid_to text,
    supersedes_relation_id text,
    properties_json text,
    created_at text not null,
    updated_at text not null,
    foreign key (subject_id) references entities(id),
    foreign key (object_id) references entities(id)
);

create table if not exists observations (
    id text primary key,
    kind text not null,
    text_inline text,
    payload_ref text,
    confidence real not null default 1,
    created_at text not null
);

create table if not exists sessions (
    id text primary key,
    task text not null,
    status text not null,
    summary text not null,
    started_at text,
    ended_at text,
    sequence integer
);

create table if not exists session_events (
    id text primary key,
    session_id text not null,
    kind text not null,
    summary text not null,
    payload_ref text,
    created_at text not null,
    foreign key (session_id) references sessions(id)
);

create table if not exists session_handoffs (
    id text primary key,
    session_id text,
    task text not null,
    status text not null,
    summary text not null,
    payload_ref text,
    created_at text not null,
    foreign key (session_id) references sessions(id)
);

create table if not exists memory_events (
    id text primary key,
    event_type text not null,
    subject_type text not null,
    subject_id text,
    source_id text,
    summary text not null,
    payload_ref text,
    actor text,
    created_at text not null,
    foreign key (source_id) references sources(id)
);

create table if not exists taxonomy_nodes (
    id text primary key,
    parent_id text,
    name text not null,
    summary text,
    created_at text not null,
    updated_at text not null,
    foreign key (parent_id) references taxonomy_nodes(id)
);

create table if not exists taxonomy_links (
    id text primary key,
    node_id text not null,
    target_type text not null,
    target_id text not null,
    created_at text not null,
    foreign key (node_id) references taxonomy_nodes(id)
);

create index if not exists chunks_content_hash_idx on chunks(content_hash);
create index if not exists chunks_source_idx on chunks(source_id);
create index if not exists aliases_normalized_value_idx on entity_aliases(normalized_value);
create index if not exists relations_subject_idx on relations(subject_id, status);
create index if not exists relations_object_idx on relations(object_id, status);
create index if not exists memory_events_created_at_idx on memory_events(created_at);
create index if not exists memory_events_subject_idx on memory_events(subject_type, subject_id);
`,
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

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
    {
        id: '002_memory_hygiene',
        sql: `
alter table observations add column content_hash text;
alter table observations add column deleted_at text;
alter table observations add column suppressed_at text;
alter table observations add column forget_reason text;

alter table chunks add column deleted_at text;
alter table chunks add column suppressed_at text;
alter table chunks add column forget_reason text;

alter table session_handoffs add column content_hash text;
alter table session_handoffs add column deleted_at text;
alter table session_handoffs add column suppressed_at text;
alter table session_handoffs add column forget_reason text;

create index if not exists observations_content_hash_idx on observations(content_hash);
create index if not exists observations_deleted_idx on observations(deleted_at, suppressed_at);
create index if not exists chunks_deleted_idx on chunks(deleted_at, suppressed_at);
create index if not exists session_handoffs_deleted_idx on session_handoffs(deleted_at, suppressed_at);
`,
    },
    {
        id: '003_mining_artifact_contract',
        sql: `
alter table sources add column source_role text;
alter table sources add column language text;
alter table sources add column topics_json text;
alter table sources add column entities_json text;
alter table sources add column metadata_json text;

alter table chunks add column source_role text;
alter table chunks add column language text;
alter table chunks add column anchor_type text;
alter table chunks add column anchor text;
alter table chunks add column heading text;
alter table chunks add column json_path text;
alter table chunks add column start_line integer;
alter table chunks add column end_line integer;
alter table chunks add column topics_json text;
alter table chunks add column entities_json text;
alter table chunks add column metadata_json text;

create table if not exists retrieval_documents (
    target_id text not null,
    target_type text not null,
    source_id text,
    source_role text,
    path text,
    anchor text,
    summary text,
    fts_text text not null,
    fts_hash text not null,
    embedding_text text not null,
    embedding_hash text not null,
    updated_at text not null,
    primary key (target_id, target_type)
);

create table if not exists target_embeddings (
    target_id text not null,
    target_type text not null,
    model text not null,
    dimensions integer not null,
    dtype text not null,
    normalized integer not null,
    embedding_hash text not null,
    vector_blob blob not null,
    created_at text not null,
    primary key (target_id, target_type, model)
);

create table if not exists modules (
    id text primary key,
    path text not null,
    source_role text,
    package_name text,
    summary text not null,
    file_count integer not null default 0,
    chunk_count integer not null default 0,
    exported_symbols_json text,
    imports_json text,
    topics_json text,
    entities_json text,
    updated_at text not null
);

create index if not exists retrieval_documents_target_idx on retrieval_documents(target_type, target_id);
create index if not exists retrieval_documents_source_idx on retrieval_documents(source_id);
create index if not exists retrieval_documents_role_idx on retrieval_documents(source_role);
create index if not exists target_embeddings_hash_idx on target_embeddings(embedding_hash);
create index if not exists modules_path_idx on modules(path);
create index if not exists sources_role_idx on sources(source_role);
create index if not exists chunks_role_idx on chunks(source_role);
create index if not exists chunks_anchor_idx on chunks(path, anchor);
`,
    },
    {
        id: '004_retrieval_fts_and_mining_suppressions',
        sql: `
create virtual table if not exists retrieval_documents_fts using fts5(
    target_id unindexed,
    target_type unindexed,
    source_role unindexed,
    path unindexed,
    anchor unindexed,
    fts_text
);

create table if not exists mined_suppressions (
    path text not null,
    anchor text not null,
    content_hash text not null,
    reason text,
    created_at text not null,
    primary key (path, anchor, content_hash)
);

create index if not exists mined_suppressions_path_idx on mined_suppressions(path);
`,
    },
    {
        id: '005_diary_entries',
        sql: `
create table if not exists diary_entries (
    id text primary key,
    subject text,
    summary text not null,
    tags_json text,
    payload_ref text,
    content_hash text,
    deleted_at text,
    suppressed_at text,
    forget_reason text,
    created_at text not null
);

create index if not exists diary_entries_deleted_idx on diary_entries(deleted_at, suppressed_at);
`,
    },
    {
        id: '006_migrate_session_handoffs_to_diary',
        sql: `
insert into diary_entries (
    id,
    subject,
    summary,
    tags_json,
    payload_ref,
    content_hash,
    deleted_at,
    suppressed_at,
    forget_reason,
    created_at
)
select
    replace(h.id, 'handoff_', 'diary_') as id,
    h.task as subject,
    h.summary,
    json('[]') as tags_json,
    h.payload_ref,
    h.content_hash,
    h.deleted_at,
    h.suppressed_at,
    h.forget_reason,
    h.created_at
from session_handoffs h
where not exists (
    select 1
    from diary_entries d
    where d.id = replace(h.id, 'handoff_', 'diary_')
);
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

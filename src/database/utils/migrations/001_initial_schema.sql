create table if not exists sources (
    id text primary key,
    type text not null,
    uri text,
    excerpt_ref text,
    source_role text,
    language text,
    topics_json text,
    entities_json text,
    metadata_json text,
    created_at text not null
);

create table if not exists sections (
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
    source_role text,
    language text,
    anchor_type text,
    anchor text,
    heading text,
    json_path text,
    start_line integer,
    end_line integer,
    topics_json text,
    entities_json text,
    metadata_json text,
    created_at text not null,
    updated_at text not null,
    deleted_at text,
    suppressed_at text,
    forget_reason text,
    foreign key (source_id) references sources(id)
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
    content_hash text,
    confidence real not null default 1,
    created_at text not null,
    deleted_at text,
    suppressed_at text,
    forget_reason text
);

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
    section_count integer not null default 0,
    exported_symbols_json text,
    imports_json text,
    topics_json text,
    entities_json text,
    updated_at text not null
);

create virtual table if not exists retrieval_documents_fts using fts5(
    target_id unindexed,
    target_type unindexed,
    source_role unindexed,
    path unindexed,
    anchor unindexed,
    fts_text
);

create table if not exists section_suppressions (
    path text not null,
    anchor text not null,
    content_hash text not null,
    reason text,
    created_at text not null,
    primary key (path, anchor, content_hash)
);

create table if not exists memory_fts_indexed (
    id text primary key,
    indexed_at text not null
);

create virtual table if not exists memory_fts using fts5(
    id unindexed,
    type unindexed,
    kind,
    task,
    content,
    created_at unindexed
);

create index if not exists sections_content_hash_idx on sections(content_hash);

create index if not exists sections_source_idx on sections(source_id);

create index if not exists sections_role_idx on sections(source_role);

create index if not exists sections_anchor_idx on sections(path, anchor);

create index if not exists sections_deleted_idx on sections(deleted_at, suppressed_at);

create index if not exists aliases_normalized_value_idx on entity_aliases(normalized_value);

create index if not exists relations_subject_idx on relations(subject_id, status);

create index if not exists relations_object_idx on relations(object_id, status);

create index if not exists memory_events_created_at_idx on memory_events(created_at);

create index if not exists memory_events_subject_idx on memory_events(subject_type, subject_id);

create index if not exists observations_content_hash_idx on observations(content_hash);

create index if not exists observations_deleted_idx on observations(deleted_at, suppressed_at);

create index if not exists diary_entries_deleted_idx on diary_entries(deleted_at, suppressed_at);

create index if not exists retrieval_documents_target_idx on retrieval_documents(target_type, target_id);

create index if not exists retrieval_documents_source_idx on retrieval_documents(source_id);

create index if not exists retrieval_documents_role_idx on retrieval_documents(source_role);

create index if not exists target_embeddings_hash_idx on target_embeddings(embedding_hash);

create index if not exists modules_path_idx on modules(path);

create index if not exists sources_role_idx on sources(source_role);

create index if not exists section_suppressions_path_idx on section_suppressions(path);

create table if not exists vector_index_entries (
    target_id text not null,
    target_type text not null,
    model text not null,
    dimensions integer not null,
    embedding_hash text not null,
    index_table text not null,
    updated_at text not null,
    primary key (target_id, target_type, model)
);

create index if not exists vector_index_entries_hash_idx on vector_index_entries(embedding_hash);

create index if not exists vector_index_entries_table_idx on vector_index_entries(index_table);

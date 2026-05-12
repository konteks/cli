import type { SqliteAdapter } from './sqlite-adapter'

export type ObservationRow = {
    id: string
    kind: string
    text_inline: string | null
    confidence: number
    created_at: string
}

export type DiaryRow = {
    id: string
    subject: string | null
    summary: string
    tags_json: string | null
    created_at: string
}

type FtsRow = {
    id: string
    type: 'chunk' | 'diary' | 'memory'
    kind: string | null
    task: string | null
    content: string
    created_at: string
    rank: number
    source_id: string | null
    token_count: number | null
    confidence: number | null
}

export type RetrievalDocumentRow = {
    anchor: string | null
    embedding_dimensions: number | null
    embedding_model: string | null
    path: string | null
    rank: number
    source_id: string | null
    source_role: string | null
    target_id: string
    target_type: 'chunk' | 'diary' | 'memory' | 'module'
    summary: string | null
    fts_text: string
    updated_at: string
    token_count: number | null
    vector_blob: Uint8Array | null
}

export async function queryObservations(
    adapter: SqliteAdapter,
    terms: string[],
    limit: number,
): Promise<ObservationRow[]> {
    return adapter.query<ObservationRow>(
        `
select id, kind, text_inline, confidence, created_at
from observations
where (${terms.map(() => "lower(coalesce(text_inline, '')) like ?").join(' or ')})
  and deleted_at is null
  and suppressed_at is null
order by created_at desc
limit ?
`,
        [...terms.map(term => `%${term}%`), limit],
    )
}

export async function queryDiaries(
    adapter: SqliteAdapter,
    terms: string[],
    limit: number,
): Promise<DiaryRow[]> {
    return adapter.query<DiaryRow>(
        `
select id, subject, summary, tags_json, created_at
from diary_entries
where (${terms
            .map(
                () =>
                    "(lower(summary) like ? or lower(coalesce(subject, '')) like ? or lower(coalesce(tags_json, '')) like ?)",
            )
            .join(' or ')})
  and deleted_at is null
  and suppressed_at is null
order by created_at desc
limit ?
`,
        [
            ...terms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]),
            limit,
        ],
    )
}

export async function queryRetrievalDocuments(
    adapter: SqliteAdapter,
    model: string,
    dimensions: number,
    ftsQuery: string,
    limit: number,
): Promise<RetrievalDocumentRow[]> {
    return adapter.query<RetrievalDocumentRow>(
        `
select
    rd.target_id,
    rd.target_type,
    rd.summary,
    rd.fts_text,
    rd.source_id,
    rd.source_role,
    rd.path,
    rd.anchor,
    rd.updated_at,
    c.token_count,
    bm25(retrieval_documents_fts) as rank,
    te.model as embedding_model,
    te.dimensions as embedding_dimensions,
    te.vector_blob
from retrieval_documents_fts
join retrieval_documents rd
    on rd.target_id = retrieval_documents_fts.target_id
   and rd.target_type = retrieval_documents_fts.target_type
left join chunks c
    on c.id = rd.target_id
   and rd.target_type = 'chunk'
left join target_embeddings te
    on te.target_id = rd.target_id
   and te.target_type = rd.target_type
   and te.model = ?
   and te.dimensions = ?
where rd.target_type in ('chunk', 'module', 'memory', 'diary')
  and retrieval_documents_fts match ?
  and not exists (
      select 1 from chunks dc
      where dc.id = rd.target_id
        and rd.target_type = 'chunk'
        and (dc.deleted_at is not null or dc.suppressed_at is not null)
  )
  and not exists (
      select 1 from observations mo
      where mo.id = rd.target_id
        and rd.target_type = 'memory'
        and (mo.deleted_at is not null or mo.suppressed_at is not null)
  )
  and not exists (
      select 1 from diary_entries dd
      where dd.id = rd.target_id
        and rd.target_type = 'diary'
        and (dd.deleted_at is not null or dd.suppressed_at is not null)
  )
order by rank
limit ?
`,
        [model, dimensions, ftsQuery, limit],
    )
}

export async function queryFtsRows(
    adapter: SqliteAdapter,
    ftsQuery: string,
    limit: number,
): Promise<FtsRow[]> {
    return adapter.query<FtsRow>(
        `
select
    memory_fts.id,
    memory_fts.type,
    memory_fts.kind,
    memory_fts.task,
    memory_fts.content,
    memory_fts.created_at,
    bm25(memory_fts) as rank,
    c.source_id,
    c.token_count,
    o.confidence
from memory_fts
left join chunks c on c.id = memory_fts.id
left join observations o on o.id = memory_fts.id
where memory_fts match ?
  and not exists (
      select 1 from chunks dc
      where dc.id = memory_fts.id
        and (dc.deleted_at is not null or dc.suppressed_at is not null)
  )
  and not exists (
      select 1 from observations do
      where do.id = memory_fts.id
        and (do.deleted_at is not null or do.suppressed_at is not null)
  )
  and not exists (
      select 1 from diary_entries dd
      where dd.id = memory_fts.id
        and (dd.deleted_at is not null or dd.suppressed_at is not null)
  )
order by rank
limit ?
`,
        [ftsQuery, limit],
    )
}

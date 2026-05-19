import type { SqliteAdapter } from '@/providers/persistence/sqlite/sqlite-adapter'

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

export default async function queryRetrievalDocuments(
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

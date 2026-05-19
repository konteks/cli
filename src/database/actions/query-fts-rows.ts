import type { SqliteAdapter } from '@/providers/persistence/sqlite/sqlite-adapter'

export type FtsRow = {
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

export default async function queryFtsRows(
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

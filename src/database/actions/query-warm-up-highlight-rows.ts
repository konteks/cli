import type { WarmUpHighlight } from '@/models/memory'
import type { SqliteAdapter } from '@/providers/persistence/sqlite/sqlite-adapter'

export type WarmUpHighlightRow = {
    anchor: string | null
    path: string | null
    source_role: string | null
    summary: string | null
    target_id: string
    target_type: WarmUpHighlight['type']
    token_count: number | null
    updated_at: string
}

export default async function queryWarmUpHighlightRows(
    adapter: SqliteAdapter,
): Promise<WarmUpHighlightRow[]> {
    return adapter.query<WarmUpHighlightRow>(
        `
select
    rd.target_id,
    rd.target_type,
    rd.source_role,
    rd.path,
    rd.anchor,
    rd.summary,
    rd.updated_at,
    c.token_count
from retrieval_documents rd
left join chunks c
    on c.id = rd.target_id
   and rd.target_type = 'chunk'
where rd.target_type in ('chunk', 'module', 'memory', 'diary')
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
order by
    case rd.target_type when 'module' then 0 when 'chunk' then 1 else 2 end,
    case rd.source_role
        when 'app_code' then 0
        when 'package_config' then 1
        when 'test_code' then 2
        when 'product_doc' then 3
        else 4
    end,
    rd.updated_at desc
limit 40
`,
    )
}

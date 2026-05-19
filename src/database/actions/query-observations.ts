import type { SqliteAdapter } from '@/providers/persistence/sqlite/sqlite-adapter'

export type ObservationRow = {
    id: string
    kind: string
    text_inline: string | null
    confidence: number
    created_at: string
}

export default async function queryObservations(
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

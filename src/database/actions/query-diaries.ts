import type { SqliteAdapter } from '@/providers/persistence/sqlite/sqlite-adapter'

export type DiaryRow = {
    id: string
    subject: string | null
    summary: string
    tags_json: string | null
    created_at: string
}

export default async function queryDiaries(
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

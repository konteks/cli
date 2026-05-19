import type { SqliteAdapter } from '@/providers/persistence/sqlite/sqlite-adapter'
import type { WarmUpObservationRow } from '@/providers/project/warm-up-ranking'

export default async function queryWarmUpObservations(
    adapter: SqliteAdapter,
): Promise<WarmUpObservationRow[]> {
    return adapter.query<WarmUpObservationRow>(
        `
select id, kind, text_inline
from observations
where deleted_at is null
  and suppressed_at is null
order by created_at desc
limit 120
`,
    )
}

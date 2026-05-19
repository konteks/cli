import type { SqliteAdapter } from '@/providers/persistence/sqlite/sqlite-adapter'

export type WarmUpModuleRow = {
    path: string
    source_role: string | null
    summary: string
}

export default async function queryWarmUpModules(
    adapter: SqliteAdapter,
): Promise<WarmUpModuleRow[]> {
    return adapter.query<WarmUpModuleRow>(
        `
select path, source_role, summary
from modules
order by chunk_count desc, file_count desc
limit 12
`,
    )
}

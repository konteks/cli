import { sql } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'

type FtsTableRow = {
    name: string
}

export default async function hasSearchIndex(
    service: SqliteConnection,
): Promise<boolean> {
    const rows = await service.db.all<FtsTableRow>(sql`
select name
from sqlite_master
where type = 'table' and name = 'memory_fts'
limit 1
`)

    return rows.length > 0
}

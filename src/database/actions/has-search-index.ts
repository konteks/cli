import { sql } from 'drizzle-orm'
import getDb from './_db'

type FtsTableRow = {
    name: string
}

export default async function hasSearchIndex(): Promise<boolean> {
    const db = await getDb()
    const rows = await db.all<FtsTableRow>(sql`
select name
from sqlite_master
where type = 'table' and name = 'memory_fts'
limit 1
`)

    return rows.length > 0
}

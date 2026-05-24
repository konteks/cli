import { sql } from 'drizzle-orm'
import getDb from '@/database/actions/_db'

export type ModuleFileRow = {
    path: string
    source_role: string
}

export default async function queryModuleFileRows(input: {
    modulePath: string
    sourceRole: string
}): Promise<ModuleFileRow[]> {
    const db = await getDb()
    const pathFilter =
        input.modulePath === '.'
            ? sql`instr(path, '/') = 0`
            : sql`path like ${`${input.modulePath}/%`}`

    return await db.all<ModuleFileRow>(sql`
select distinct path
    , coalesce(source_role, 'unknown') as source_role
from sections
where deleted_at is null
  and suppressed_at is null
  and path is not null
  and coalesce(source_role, 'unknown') = ${input.sourceRole}
  and ${pathFilter}
order by path
`)
}

import { sql } from 'drizzle-orm'
import getDb from '@/database/actions/_db'

export type ModuleSummaryRow = {
    file_count: number
    module_path: string
    section_count: number
    source_role: string
}

export default async function queryModuleSummaryRows(): Promise<
    ModuleSummaryRow[]
> {
    const db = await getDb()

    return await db.all<ModuleSummaryRow>(sql`
select
    case
        when instr(path, '/') > 0 then substr(path, 1, instr(path, '/') - 1)
        else '.'
    end as module_path,
    coalesce(source_role, 'unknown') as source_role,
    count(distinct path) as file_count,
    count(*) as section_count
from sections
where deleted_at is null
  and suppressed_at is null
group by module_path, source_role
order by section_count desc, module_path
`)
}

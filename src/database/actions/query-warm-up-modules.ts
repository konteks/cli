import { desc } from 'drizzle-orm'
import { modules } from '@/database/schema'
import getDb from './_db'

export type WarmUpModuleRow = {
    path: string
    source_role: string | null
    summary: string
}

export default async function queryWarmUpModules(): Promise<WarmUpModuleRow[]> {
    const db = await getDb()
    return db
        .select({
            path: modules.path,
            source_role: modules.sourceRole,
            summary: modules.summary,
        })
        .from(modules)
        .orderBy(desc(modules.sectionCount), desc(modules.fileCount))
        .limit(12)
}

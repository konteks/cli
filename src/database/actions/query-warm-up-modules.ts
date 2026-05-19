import { desc } from 'drizzle-orm'
import { modules } from '@/providers/persistence/sqlite/schema'
import db from './_db'

export type WarmUpModuleRow = {
    path: string
    source_role: string | null
    summary: string
}

export default async function queryWarmUpModules(): Promise<WarmUpModuleRow[]> {
    return db
        .select({
            path: modules.path,
            source_role: modules.sourceRole,
            summary: modules.summary,
        })
        .from(modules)
        .orderBy(desc(modules.chunkCount), desc(modules.fileCount))
        .limit(12)
}

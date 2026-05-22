import { eq } from 'drizzle-orm'
import { sections, sources } from '@/database/schema'
import { EXTRACTED_FILE_SOURCE_TYPE } from '@/modules/extraction/engine/source-types'
import getDb from './_db'

export default async function readExtractedProjectPaths(): Promise<
    Set<string>
> {
    const db = await getDb()
    const rows = await db
        .selectDistinct({ path: sources.uri })
        .from(sources)
        .innerJoin(sections, eq(sections.sourceId, sources.id))
        .where(eq(sources.type, EXTRACTED_FILE_SOURCE_TYPE))

    return new Set(rows.flatMap(row => (row.path ? [row.path] : [])))
}

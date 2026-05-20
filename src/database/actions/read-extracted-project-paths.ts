import { eq } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { chunks, sources } from '@/database/schema'
import { EXTRACTED_FILE_SOURCE_TYPE } from '@/providers/extraction/engine/source-types'

export default async function readExtractedProjectPaths(
    connection: SqliteConnection,
): Promise<Set<string>> {
    const rows = await connection.db
        .selectDistinct({ path: sources.uri })
        .from(sources)
        .innerJoin(chunks, eq(chunks.sourceId, sources.id))
        .where(eq(sources.type, EXTRACTED_FILE_SOURCE_TYPE))

    return new Set(rows.flatMap(row => (row.path ? [row.path] : [])))
}

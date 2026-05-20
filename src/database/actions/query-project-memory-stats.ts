import { and, count, eq, isNull } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import {
    chunks,
    diaryEntries,
    memoryEvents,
    modules,
    observations,
    retrievalDocuments,
    sources,
    targetEmbeddings,
} from '@/database/schema'
import type { ProjectMemoryStats } from '@/database/services/project-status'
import { EXTRACTED_FILE_SOURCE_TYPE } from '@/providers/extraction/engine/source-types'

export default async function queryProjectMemoryStats(
    connection: SqliteConnection,
): Promise<ProjectMemoryStats> {
    const [
        files,
        sections,
        moduleCount,
        memories,
        diaryCount,
        retrievalDocumentCount,
        embeddings,
        events,
    ] = await Promise.all([
        countFrom(
            connection.db
                .select({ count: count() })
                .from(sources)
                .where(eq(sources.type, EXTRACTED_FILE_SOURCE_TYPE)),
        ),
        countFrom(
            connection.db
                .select({ count: count() })
                .from(chunks)
                .where(
                    and(isNull(chunks.deletedAt), isNull(chunks.suppressedAt)),
                ),
        ),
        countFrom(connection.db.select({ count: count() }).from(modules)),
        countFrom(
            connection.db
                .select({ count: count() })
                .from(observations)
                .where(
                    and(
                        isNull(observations.deletedAt),
                        isNull(observations.suppressedAt),
                    ),
                ),
        ),
        countFrom(
            connection.db
                .select({ count: count() })
                .from(diaryEntries)
                .where(
                    and(
                        isNull(diaryEntries.deletedAt),
                        isNull(diaryEntries.suppressedAt),
                    ),
                ),
        ),
        countFrom(
            connection.db.select({ count: count() }).from(retrievalDocuments),
        ),
        countFrom(
            connection.db.select({ count: count() }).from(targetEmbeddings),
        ),
        countFrom(connection.db.select({ count: count() }).from(memoryEvents)),
    ])

    return {
        diaryEntries: diaryCount,
        embeddings,
        events,
        files,
        memories,
        modules: moduleCount,
        retrievalDocuments: retrievalDocumentCount,
        sections,
    }
}

async function countFrom(
    query: Promise<Array<{ count: number }>>,
): Promise<number> {
    const rows = await query
    return rows[0]?.count ?? 0
}

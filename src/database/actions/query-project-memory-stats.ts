import { and, count, eq, isNull } from 'drizzle-orm'
import {
    diaryEntries,
    memoryEvents,
    modules,
    observations,
    retrievalDocuments,
    sections,
    sources,
    targetEmbeddings,
} from '@/database/schema'
import type { ProjectMemoryStats } from '@/database/services/project-status'
import { EXTRACTED_FILE_SOURCE_TYPE } from '@/modules/extraction/engine/source-types'
import getDb from './_db'

export default async function queryProjectMemoryStats(): Promise<ProjectMemoryStats> {
    const db = await getDb()
    const [
        files,
        sectionCount,
        moduleCount,
        memories,
        diaryCount,
        retrievalDocumentCount,
        embeddings,
        events,
    ] = await Promise.all([
        countFrom(
            db
                .select({ count: count() })
                .from(sources)
                .where(eq(sources.type, EXTRACTED_FILE_SOURCE_TYPE)),
        ),
        countFrom(
            db
                .select({ count: count() })
                .from(sections)
                .where(
                    and(
                        isNull(sections.deletedAt),
                        isNull(sections.suppressedAt),
                    ),
                ),
        ),
        countFrom(db.select({ count: count() }).from(modules)),
        countFrom(
            db
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
            db
                .select({ count: count() })
                .from(diaryEntries)
                .where(
                    and(
                        isNull(diaryEntries.deletedAt),
                        isNull(diaryEntries.suppressedAt),
                    ),
                ),
        ),
        countFrom(db.select({ count: count() }).from(retrievalDocuments)),
        countFrom(db.select({ count: count() }).from(targetEmbeddings)),
        countFrom(db.select({ count: count() }).from(memoryEvents)),
    ])

    return {
        diaryEntries: diaryCount,
        embeddings,
        events,
        files,
        memories,
        modules: moduleCount,
        retrievalDocuments: retrievalDocumentCount,
        sections: sectionCount,
    }
}

async function countFrom(
    query: Promise<Array<{ count: number }>>,
): Promise<number> {
    const rows = await query
    return rows[0]?.count ?? 0
}

import { and, eq, inArray } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { retrievalDocuments, retrievalDocumentsFts } from '@/database/schema'
import type { RetrievalDocumentInput } from './upsert-retrieval-document'

export default async function deleteRetrievalDocuments(
    db: SqliteConnection,
    targetType: RetrievalDocumentInput['targetType'],
    targetIds?: string[],
): Promise<void> {
    if (targetIds && targetIds.length === 0) {
        return
    }

    if (targetIds) {
        await db.db
            .delete(retrievalDocumentsFts)
            .where(
                and(
                    eq(retrievalDocumentsFts.targetType, targetType),
                    inArray(retrievalDocumentsFts.targetId, targetIds),
                ),
            )
        await db.db
            .delete(retrievalDocuments)
            .where(
                and(
                    eq(retrievalDocuments.targetType, targetType),
                    inArray(retrievalDocuments.targetId, targetIds),
                ),
            )
        return
    }

    await db.db
        .delete(retrievalDocumentsFts)
        .where(eq(retrievalDocumentsFts.targetType, targetType))
    await db.db
        .delete(retrievalDocuments)
        .where(eq(retrievalDocuments.targetType, targetType))
}

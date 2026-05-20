import { and, eq, inArray } from 'drizzle-orm'
import { retrievalDocuments, retrievalDocumentsFts } from '@/database/schema'
import getDb from './_db'
import type { RetrievalDocumentInput } from './upsert-retrieval-document'

export default async function deleteRetrievalDocuments(
    targetType: RetrievalDocumentInput['targetType'],
    targetIds?: string[],
): Promise<void> {
    const db = await getDb()
    if (targetIds && targetIds.length === 0) {
        return
    }

    if (targetIds) {
        await db
            .delete(retrievalDocumentsFts)
            .where(
                and(
                    eq(retrievalDocumentsFts.targetType, targetType),
                    inArray(retrievalDocumentsFts.targetId, targetIds),
                ),
            )
        await db
            .delete(retrievalDocuments)
            .where(
                and(
                    eq(retrievalDocuments.targetType, targetType),
                    inArray(retrievalDocuments.targetId, targetIds),
                ),
            )
        return
    }

    await db
        .delete(retrievalDocumentsFts)
        .where(eq(retrievalDocumentsFts.targetType, targetType))
    await db
        .delete(retrievalDocuments)
        .where(eq(retrievalDocuments.targetType, targetType))
}

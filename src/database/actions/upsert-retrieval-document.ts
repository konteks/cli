import { and, eq } from 'drizzle-orm'
import { retrievalDocuments, retrievalDocumentsFts } from '@/database/schema'
import contentHash from '@/support/content-hash'
import getDb from './_db'

export type RetrievalDocumentInput = {
    anchor?: string
    embeddingText: string
    ftsText: string
    path?: string
    sourceId?: string
    sourceRole?: string
    summary?: string
    targetId: string
    targetType: 'section' | 'diary' | 'memory' | 'module'
    updatedAt: string
}

export default async function upsertRetrievalDocument(
    input: RetrievalDocumentInput,
): Promise<void> {
    const db = await getDb()
    const value = {
        anchor: input.anchor ?? null,
        embeddingHash: contentHash(input.embeddingText),
        embeddingText: input.embeddingText,
        ftsHash: contentHash(input.ftsText),
        ftsText: input.ftsText,
        path: input.path ?? null,
        sourceId: input.sourceId ?? null,
        sourceRole: input.sourceRole ?? null,
        summary: input.summary ?? null,
        targetId: input.targetId,
        targetType: input.targetType,
        updatedAt: input.updatedAt,
    }
    await db
        .insert(retrievalDocuments)
        .values(value)
        .onConflictDoUpdate({
            set: value,
            target: [
                retrievalDocuments.targetId,
                retrievalDocuments.targetType,
            ],
        })
    await db
        .delete(retrievalDocumentsFts)
        .where(
            and(
                eq(retrievalDocumentsFts.targetId, input.targetId),
                eq(retrievalDocumentsFts.targetType, input.targetType),
            ),
        )
    await db.insert(retrievalDocumentsFts).values({
        anchor: value.anchor,
        ftsText: value.ftsText,
        path: value.path,
        sourceRole: value.sourceRole,
        targetId: value.targetId,
        targetType: value.targetType,
    })
}

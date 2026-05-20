import { and, eq } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { retrievalDocuments, retrievalDocumentsFts } from '@/database/schema'
import { contentHash } from '@/providers/persistence/objects/content'

export type RetrievalDocumentInput = {
    anchor?: string
    embeddingText: string
    ftsText: string
    path?: string
    sourceId?: string
    sourceRole?: string
    summary?: string
    targetId: string
    targetType: 'chunk' | 'diary' | 'memory' | 'module'
    updatedAt: string
}

export default async function upsertRetrievalDocument(
    db: SqliteConnection,
    input: RetrievalDocumentInput,
): Promise<void> {
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
    await db.db
        .insert(retrievalDocuments)
        .values(value)
        .onConflictDoUpdate({
            set: value,
            target: [
                retrievalDocuments.targetId,
                retrievalDocuments.targetType,
            ],
        })
    await db.db
        .delete(retrievalDocumentsFts)
        .where(
            and(
                eq(retrievalDocumentsFts.targetId, input.targetId),
                eq(retrievalDocumentsFts.targetType, input.targetType),
            ),
        )
    await db.db.insert(retrievalDocumentsFts).values({
        ftsText: input.ftsText,
        targetId: input.targetId,
        targetType: input.targetType,
    })
}

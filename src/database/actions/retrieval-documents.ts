import { and, eq, inArray, sql } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { retrievalDocuments, retrievalDocumentsFts } from '@/database/schema'
import { contentHash } from '@/providers/persistence/objects/content'

const maxChunkContentChars = 3000
const maxEmbeddingTextChars = 2500
const maxFtsTextChars = 6000

type RetrievalDocumentInput = {
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

export async function upsertRetrievalDocument(
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

export async function deleteRetrievalDocuments(
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

export async function reindexRetrievalDocumentFts(
    db: SqliteConnection,
): Promise<void> {
    await db.db.delete(retrievalDocumentsFts)
    await db.db.run(sql`
insert into retrieval_documents_fts (
    target_id,
    target_type,
    source_role,
    path,
    anchor,
    fts_text
)
select
    target_id,
    target_type,
    source_role,
    path,
    anchor,
    fts_text
from retrieval_documents
`)
}

export function buildChunkRetrievalTexts(input: {
    anchor?: string
    content: string
    language: string
    path: string
    sourceRole: string
    summary: string
    topics: string[]
}): { embeddingText: string; ftsText: string } {
    const topicText = input.topics.join(', ')
    const location = input.anchor ? `${input.path}#${input.anchor}` : input.path
    const metadata = [
        `path: ${location}`,
        `role: ${input.sourceRole}`,
        `language: ${input.language}`,
        input.anchor ? `anchor: ${input.anchor}` : '',
        topicText ? `topics: ${topicText}` : '',
        `summary: ${input.summary}`,
    ]
        .filter(Boolean)
        .join('\n')
    const contentExcerpt = input.content.slice(0, maxChunkContentChars)

    return {
        embeddingText: `${metadata}\ncontent:\n${contentExcerpt}`.slice(
            0,
            maxEmbeddingTextChars,
        ),
        ftsText: `${metadata}\n${input.content}`.slice(0, maxFtsTextChars),
    }
}

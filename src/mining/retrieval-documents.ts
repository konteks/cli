import { contentHash } from '../storage/content.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'

export const maxChunkContentChars = 3000
export const maxEmbeddingTextChars = 2500
export const maxFtsTextChars = 6000

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
    adapter: SqliteAdapter,
    input: RetrievalDocumentInput,
): Promise<void> {
    await adapter.execute(
        `
insert or replace into retrieval_documents (
    target_id,
    target_type,
    source_id,
    source_role,
    path,
    anchor,
    summary,
    fts_text,
    fts_hash,
    embedding_text,
    embedding_hash,
    updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
        [
            input.targetId,
            input.targetType,
            input.sourceId ?? null,
            input.sourceRole ?? null,
            input.path ?? null,
            input.anchor ?? null,
            input.summary ?? null,
            input.ftsText,
            contentHash(input.ftsText),
            input.embeddingText,
            contentHash(input.embeddingText),
            input.updatedAt,
        ],
    )
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

import type { DatabaseService } from '@/app/providers/database/sqlite/db'
import { contentHash } from '@/app/providers/storage/content'

const maxChunkContentChars = 3000
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
    db: DatabaseService,
    input: RetrievalDocumentInput,
): Promise<void> {
    const adapter = db.adapter
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
    await adapter.execute(
        `
delete from retrieval_documents_fts
where target_id = ? and target_type = ?
`,
        [input.targetId, input.targetType],
    )
    await adapter.execute(
        `
insert into retrieval_documents_fts (
    target_id,
    target_type,
    source_role,
    path,
    anchor,
    fts_text
) values (?, ?, ?, ?, ?, ?)
`,
        [
            input.targetId,
            input.targetType,
            input.sourceRole ?? null,
            input.path ?? null,
            input.anchor ?? null,
            input.ftsText,
        ],
    )
}

export async function deleteRetrievalDocuments(
    db: DatabaseService,
    targetType: RetrievalDocumentInput['targetType'],
    targetIds?: string[],
): Promise<void> {
    const adapter = db.adapter
    if (targetIds && targetIds.length === 0) {
        return
    }

    if (targetIds) {
        const placeholders = targetIds.map(() => '?').join(', ')
        await adapter.execute(
            `
delete from retrieval_documents_fts
where target_type = ?
  and target_id in (${placeholders})
`,
            [targetType, ...targetIds],
        )
        await adapter.execute(
            `
delete from retrieval_documents
where target_type = ?
  and target_id in (${placeholders})
`,
            [targetType, ...targetIds],
        )
        return
    }

    await adapter.execute(
        'delete from retrieval_documents_fts where target_type = ?',
        [targetType],
    )
    await adapter.execute(
        'delete from retrieval_documents where target_type = ?',
        [targetType],
    )
}

export async function reindexRetrievalDocumentFts(
    db: DatabaseService,
): Promise<void> {
    const adapter = db.adapter
    await adapter.execute('delete from retrieval_documents_fts')
    await adapter.execute(`
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
where target_type in ('chunk', 'module');
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

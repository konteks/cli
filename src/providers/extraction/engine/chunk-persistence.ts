import type { DatabaseService } from '@/providers/persistence/sqlite/db'
import { upsertRetrievalDocument } from '@/providers/persistence/sqlite/retrieval-documents'
import { indexSearchDocument } from '@/providers/persistence/sqlite/search-index'
import type { TaxonomyStore } from '@/providers/persistence/sqlite/stores/taxonomy-store'
import type { PreparedFile } from './chunk-preparation'
import { EXTRACTED_FILE_SOURCE_TYPE } from './source-types'

export async function persistPreparedFileChunks(input: {
    db: DatabaseService
    extractedAt: string
    preparedFile: PreparedFile
    rootNodeId: string
    taxonomy: TaxonomyStore
}): Promise<number> {
    const { db, extractedAt, preparedFile, rootNodeId, taxonomy } = input

    await db.sources.insert({
        entities_json: JSON.stringify([]),
        excerpt_ref: null,
        id: preparedFile.sourceId,
        language: preparedFile.language,
        metadata_json: JSON.stringify(preparedFile.sourceMetadata),
        source_role: preparedFile.sourceRole,
        topics_json: JSON.stringify(preparedFile.sourceTopics),
        type: EXTRACTED_FILE_SOURCE_TYPE,
        uri: preparedFile.path,
    })

    const taxonomyNode = await ensurePathTaxonomy(
        taxonomy,
        rootNodeId,
        preparedFile.path,
    )

    for (const chunk of preparedFile.chunks) {
        await db.chunks.insert({
            anchor: chunk.anchor,
            anchor_type: chunk.anchorType,
            content_hash: chunk.contentHash,
            content_inline: chunk.contentInline ?? null,
            end_line: chunk.endLine ?? null,
            entities_json: JSON.stringify([]),
            heading: chunk.heading ?? null,
            id: chunk.id,
            json_path: chunk.jsonPath ?? null,
            kind: chunk.kind,
            language: preparedFile.language,
            metadata_json: JSON.stringify(chunk.metadata ?? {}),
            path: chunk.path,
            payload_ref: chunk.payloadRef ?? null,
            source_id: preparedFile.sourceId,
            source_role: preparedFile.sourceRole,
            start_line: chunk.startLine ?? null,
            summary: chunk.summary,
            symbol: chunk.symbol ?? null,
            token_count: chunk.tokenCount,
            topics_json: JSON.stringify(chunk.topics),
        })

        await taxonomy.linkTarget({
            nodeId: taxonomyNode.id,
            targetId: chunk.id,
            targetType: 'chunk',
        })
        await indexSearchDocument(db.adapter, {
            content: chunk.contentInline ?? chunk.summary,
            createdAt: extractedAt,
            id: chunk.id,
            kind: chunk.kind,
            task: chunk.path,
            type: 'chunk',
        })
        await upsertRetrievalDocument(db, {
            anchor: chunk.anchor,
            embeddingText: chunk.retrievalTexts.embeddingText,
            ftsText: chunk.retrievalTexts.ftsText,
            path: chunk.path,
            sourceId: preparedFile.sourceId,
            sourceRole: preparedFile.sourceRole,
            summary: chunk.summary,
            targetId: chunk.id,
            targetType: 'chunk',
            updatedAt: extractedAt,
        })
    }

    return preparedFile.chunks.length
}

async function ensurePathTaxonomy(
    taxonomy: TaxonomyStore,
    rootNodeId: string,
    path: string,
) {
    const parts = path.split('/')
    const directories = parts.slice(0, -1)
    let parentId = rootNodeId

    for (const directory of directories) {
        const node = await taxonomy.upsertNode({
            name: directory,
            parentId,
        })
        parentId = node.id
    }

    return taxonomy.upsertNode({
        name: parts.at(-1) ?? path,
        parentId,
    })
}

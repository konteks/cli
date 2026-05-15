import type DatabaseService from '@/providers/persistence/sqlite/database-service'
import { upsertRetrievalDocument } from '@/providers/persistence/sqlite/retrieval-documents'
import { indexSearchDocument } from '@/providers/persistence/sqlite/search-index'
import type TaxonomyStore from '@/providers/persistence/sqlite/stores/taxonomy-store'
import type { PreparedFile } from './prepare-file-sections'
import { EXTRACTED_FILE_SOURCE_TYPE } from './source-types'

/**
 * Compatibility boundary: extraction code calls these units "sections", but
 * persisted storage still uses the legacy "chunk" term. Do not rename the
 * `chunks` table, `chunk_*` IDs, `targetType: 'chunk'`, or manifest fields
 * without an explicit migration and compatibility plan.
 */
export default async function persistPreparedFileSections(input: {
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

    for (const section of preparedFile.sections) {
        await db.chunks.insert({
            anchor: section.anchor,
            anchor_type: section.anchorType,
            content_hash: section.contentHash,
            content_inline: section.contentInline ?? null,
            end_line: section.endLine ?? null,
            entities_json: JSON.stringify([]),
            heading: section.heading ?? null,
            id: section.id,
            json_path: section.jsonPath ?? null,
            kind: section.kind,
            language: preparedFile.language,
            metadata_json: JSON.stringify(section.metadata ?? {}),
            path: section.path,
            payload_ref: section.payloadRef ?? null,
            source_id: preparedFile.sourceId,
            source_role: preparedFile.sourceRole,
            start_line: section.startLine ?? null,
            summary: section.summary,
            symbol: section.symbol ?? null,
            token_count: section.tokenCount,
            topics_json: JSON.stringify(section.topics),
        })

        await taxonomy.linkTarget({
            nodeId: taxonomyNode.id,
            targetId: section.id,
            targetType: 'chunk',
        })
        await indexSearchDocument(db.adapter, {
            content: section.contentInline ?? section.summary,
            createdAt: extractedAt,
            id: section.id,
            kind: section.kind,
            task: section.path,
            type: 'chunk',
        })
        await upsertRetrievalDocument(db, {
            anchor: section.anchor,
            embeddingText: section.retrievalTexts.embeddingText,
            ftsText: section.retrievalTexts.ftsText,
            path: section.path,
            sourceId: preparedFile.sourceId,
            sourceRole: preparedFile.sourceRole,
            summary: section.summary,
            targetId: section.id,
            targetType: 'chunk',
            updatedAt: extractedAt,
        })
    }

    return preparedFile.sections.length
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

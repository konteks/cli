import indexSearchDocument from '@/database/actions/index-search-document'
import insertSection from '@/database/actions/insert-section'
import insertSource from '@/database/actions/insert-source'
import upsertRetrievalDocument from '@/database/actions/upsert-retrieval-document'
import { linkTarget, upsertNode } from '@/database/services/taxonomy'
import type { PreparedFile } from './prepare-file-sections'
import { EXTRACTED_FILE_SOURCE_TYPE } from './source-types'

export default async function persistPreparedFileSections(input: {
    extractedAt: string
    preparedFile: PreparedFile
    rootNodeId: string
}): Promise<number> {
    const { extractedAt, preparedFile, rootNodeId } = input

    await insertSource({
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

    const taxonomyNode = await ensurePathTaxonomy(rootNodeId, preparedFile.path)

    for (const section of preparedFile.sections) {
        await insertSection({
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
            source_id: preparedFile.sourceId,
            source_role: preparedFile.sourceRole,
            start_line: section.startLine ?? null,
            summary: section.summary,
            symbol: section.symbol ?? null,
            token_count: section.tokenCount,
            topics_json: JSON.stringify(section.topics),
        })

        await linkTarget({
            nodeId: taxonomyNode.id,
            targetId: section.id,
            targetType: 'section',
        })
        await indexSearchDocument({
            content: section.contentInline ?? section.summary,
            createdAt: extractedAt,
            id: section.id,
            kind: section.kind,
            task: section.path,
            type: 'section',
        })
        await upsertRetrievalDocument({
            anchor: section.anchor,
            embeddingText: section.retrievalTexts.embeddingText,
            ftsText: section.retrievalTexts.ftsText,
            path: section.path,
            sourceId: preparedFile.sourceId,
            sourceRole: preparedFile.sourceRole,
            summary: section.summary,
            targetId: section.id,
            targetType: 'section',
            updatedAt: extractedAt,
        })
    }

    return preparedFile.sections.length
}

async function ensurePathTaxonomy(rootNodeId: string, path: string) {
    const parts = path.split('/')
    const directories = parts.slice(0, -1)
    let parentId = rootNodeId

    for (const directory of directories) {
        const node = await upsertNode({
            name: directory,
            parentId,
        })
        parentId = node.id
    }

    return upsertNode({
        name: parts.at(-1) ?? path,
        parentId,
    })
}

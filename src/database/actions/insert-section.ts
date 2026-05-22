import { sections } from '@/database/schema'
import getDb from './_db'

export type InsertSectionInput = {
    anchor: string | null
    anchor_type: string | null
    content_hash: string
    content_inline: string | null
    end_line: number | null
    entities_json: string | null
    heading: string | null
    id: string
    json_path: string | null
    kind: string
    language: string | null
    metadata_json: string | null
    path: string | null
    payload_ref: string | null
    source_id: string | null
    source_role: string | null
    start_line: number | null
    summary: string | null
    symbol: string | null
    token_count: number
    topics_json: string | null
}

export default async function insertSection(
    section: InsertSectionInput,
): Promise<void> {
    const now = new Date().toISOString()

    const db = await getDb()
    await db.insert(sections).values({
        anchor: section.anchor,
        anchorType: section.anchor_type,
        contentHash: section.content_hash,
        contentInline: section.content_inline,
        createdAt: now,
        endLine: section.end_line,
        entitiesJson: section.entities_json,
        heading: section.heading,
        id: section.id,
        jsonPath: section.json_path,
        kind: section.kind,
        language: section.language,
        metadataJson: section.metadata_json,
        path: section.path,
        payloadRef: section.payload_ref,
        sourceId: section.source_id,
        sourceRole: section.source_role,
        startLine: section.start_line,
        summary: section.summary,
        symbol: section.symbol,
        tokenCount: section.token_count,
        topicsJson: section.topics_json,
        updatedAt: now,
    })
}

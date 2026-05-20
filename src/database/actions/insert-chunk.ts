import { chunks } from '@/database/schema'
import getDb from './_db'

export type InsertChunkInput = {
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

export default async function insertChunk(
    chunk: InsertChunkInput,
): Promise<void> {
    const now = new Date().toISOString()

    const db = await getDb()
    await db.insert(chunks).values({
        anchor: chunk.anchor,
        anchorType: chunk.anchor_type,
        contentHash: chunk.content_hash,
        contentInline: chunk.content_inline,
        createdAt: now,
        endLine: chunk.end_line,
        entitiesJson: chunk.entities_json,
        heading: chunk.heading,
        id: chunk.id,
        jsonPath: chunk.json_path,
        kind: chunk.kind,
        language: chunk.language,
        metadataJson: chunk.metadata_json,
        path: chunk.path,
        payloadRef: chunk.payload_ref,
        sourceId: chunk.source_id,
        sourceRole: chunk.source_role,
        startLine: chunk.start_line,
        summary: chunk.summary,
        symbol: chunk.symbol,
        tokenCount: chunk.token_count,
        topicsJson: chunk.topics_json,
        updatedAt: now,
    })
}

import { sql } from '@/services/database.js'
import { chunks } from '../schema.js'
import type { KonteksDatabase, SqliteAdapter } from '../sqlite-adapter.js'

export type ChunkRow = {
    id: string
    source_id: string | null
    kind: string
    path: string | null
    anchor: string | null
    summary: string | null
    content_inline: string | null
    payload_ref: string | null
    content_hash: string
    token_count: number
    source_role: string | null
    language: string | null
    anchor_type: string | null
    heading: string | null
    json_path: string | null
    symbol: string | null
    start_line: number | null
    end_line: number | null
    topics_json: string | null
    entities_json: string | null
    metadata_json: string | null
    created_at: string
    updated_at: string
}

export class ChunkStore {
    constructor(
        private readonly adapter: SqliteAdapter,
        private readonly db?: KonteksDatabase,
    ) {}

    async insert(
        chunk: Omit<ChunkRow, 'created_at' | 'updated_at'>,
    ): Promise<void> {
        const now = new Date().toISOString()

        if (this.db) {
            await this.db.insert(chunks).values({
                ...chunk,
                // Drizzle schema uses camelCase for columns
                anchor: chunk.anchor,
                anchorType: chunk.anchor_type,
                contentHash: chunk.content_hash,
                contentInline: chunk.content_inline,
                createdAt: now,
                endLine: chunk.end_line,
                entitiesJson: chunk.entities_json,
                jsonPath: chunk.json_path,
                metadataJson: chunk.metadata_json,
                payloadRef: chunk.payload_ref,
                sourceId: chunk.source_id,
                sourceRole: chunk.source_role,
                startLine: chunk.start_line,
                tokenCount: chunk.token_count,
                topicsJson: chunk.topics_json,
                updatedAt: now,
            })
            return
        }

        await this.adapter.execute(
            `
insert into chunks (
    id, source_id, kind, path, anchor, summary, content_inline, payload_ref,
    content_hash, token_count, source_role, language, anchor_type, heading,
    json_path, symbol, start_line, end_line, topics_json, entities_json,
    metadata_json, created_at, updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                chunk.id,
                chunk.source_id,
                chunk.kind,
                chunk.path,
                chunk.anchor,
                chunk.summary,
                chunk.content_inline,
                chunk.payload_ref,
                chunk.content_hash,
                chunk.token_count,
                chunk.source_role,
                chunk.language,
                chunk.anchor_type,
                chunk.heading,
                chunk.json_path,
                chunk.symbol,
                chunk.start_line,
                chunk.end_line,
                chunk.topics_json,
                chunk.entities_json,
                chunk.metadata_json,
                now,
                now,
            ],
        )
    }

    async findByAnchor(
        path: string,
        anchor: string,
    ): Promise<ChunkRow | undefined> {
        if (this.db) {
            const row = await this.db.query.chunks.findFirst({
                where: sql`${chunks.path} = ${path} and ${chunks.anchor} = ${anchor}`,
            })
            return row ? rowToChunkRow(row) : undefined
        }

        const rows = await this.adapter.query<ChunkRow>(
            'select * from chunks where path = ? and anchor = ? limit 1',
            [path, anchor],
        )
        return rows[0]
    }
}

// biome-ignore lint/suspicious: will fix this later
function rowToChunkRow(row: any): ChunkRow {
    return {
        anchor: row.anchor,
        anchor_type: row.anchorType,
        content_hash: row.contentHash,
        content_inline: row.contentInline,
        created_at: row.createdAt,
        end_line: row.endLine,
        entities_json: row.entitiesJson,
        heading: row.heading,
        id: row.id,
        json_path: row.jsonPath,
        kind: row.kind,
        language: row.language,
        metadata_json: row.metadataJson,
        path: row.path,
        payload_ref: row.payloadRef,
        source_id: row.sourceId,
        source_role: row.sourceRole,
        start_line: row.startLine,
        summary: row.summary,
        symbol: row.symbol,
        token_count: row.tokenCount,
        topics_json: row.topicsJson,
        updated_at: row.updatedAt,
    }
}

import {
    executeSql,
    type KonteksDatabase,
    type SqliteExecutor,
} from '../libsql-helpers'
import { sources } from '../schema'

export type SourceRow = {
    id: string
    type: string
    uri: string | null
    excerpt_ref: string | null
    source_role: string | null
    language: string | null
    topics_json: string | null
    entities_json: string | null
    metadata_json: string | null
    created_at: string
}

export default class SourceStore {
    public constructor(
        private readonly client: SqliteExecutor,
        private readonly db?: KonteksDatabase,
    ) {}

    public async insert(source: Omit<SourceRow, 'created_at'>): Promise<void> {
        const now = new Date().toISOString()

        if (this.db) {
            await this.db.insert(sources).values({
                createdAt: now,
                entitiesJson: source.entities_json,
                excerptRef: source.excerpt_ref,
                id: source.id,
                language: source.language,
                metadataJson: source.metadata_json,
                sourceRole: source.source_role,
                topicsJson: source.topics_json,
                type: source.type,
                uri: source.uri,
            })
            return
        }

        await executeSql(
            this.client,
            `
insert into sources (
    id, type, uri, excerpt_ref, source_role, language, topics_json,
    entities_json, metadata_json, created_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                source.id,
                source.type,
                source.uri,
                source.excerpt_ref,
                source.source_role,
                source.language,
                source.topics_json,
                source.entities_json,
                source.metadata_json,
                now,
            ],
        )
    }
}

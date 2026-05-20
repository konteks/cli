import { sources } from '@/database/schema'
import getDb from './_db'

export type SourceInput = {
    entities_json: string | null
    excerpt_ref: string | null
    id: string
    language: string | null
    metadata_json: string | null
    source_role: string | null
    topics_json: string | null
    type: string
    uri: string | null
}

export default async function insertSource(source: SourceInput): Promise<void> {
    const db = await getDb()
    await db.insert(sources).values({
        createdAt: new Date().toISOString(),
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
}

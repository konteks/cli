import { eq } from 'drizzle-orm'
import { entities } from '@/database/schema'
import type { EntityRecord } from '@/database/services/graph'
import getDb from './_db'
import type { EntityRow } from './query-entity-search-rows'

export default async function findEntityByCanonicalName(
    canonicalName: string,
): Promise<EntityRecord | undefined> {
    const db = await getDb()
    const rows = await db
        .select({
            canonical_name: entities.canonicalName,
            id: entities.id,
            name: entities.name,
            summary: entities.summary,
            type: entities.type,
        })
        .from(entities)
        .where(eq(entities.canonicalName, normalizeEntityName(canonicalName)))
        .limit(1)

    return rows[0] ? entityFromRow(rows[0]) : undefined
}

function entityFromRow(row: EntityRow): EntityRecord {
    return {
        canonicalName: row.canonical_name,
        id: row.id,
        name: row.name,
        summary: row.summary ?? undefined,
        type: row.type,
    }
}

function normalizeEntityName(name: string): string {
    return name.trim().toLowerCase().replaceAll(/\s+/gu, ' ')
}

import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { entities, entityAliases } from '@/database/schema'
import type { EntityInput, EntityRecord } from '@/database/services/graph'
import getDb from './_db'
import findEntityByCanonicalName from './find-entity-by-canonical-name'

export default async function upsertEntity(
    input: EntityInput,
): Promise<EntityRecord> {
    const db = await getDb()
    const canonicalName = normalizeEntityName(input.name)
    const existing = await findEntityByCanonicalName(canonicalName)
    const now = new Date().toISOString()

    if (existing) {
        await db
            .update(entities)
            .set({
                name: input.name,
                ...(input.properties
                    ? { propertiesJson: JSON.stringify(input.properties) }
                    : {}),
                ...(input.summary !== undefined
                    ? { summary: input.summary }
                    : {}),
                type: input.type,
                updatedAt: now,
            })
            .where(eq(entities.id, existing.id))
        await addAliases(existing.id, input.aliases ?? [], now)
        return {
            ...existing,
            name: input.name,
            summary: input.summary ?? existing.summary,
            type: input.type,
        }
    }

    const entity: EntityRecord = {
        canonicalName,
        id: `ent_${randomUUID()}`,
        name: input.name,
        summary: input.summary,
        type: input.type,
    }

    await db.insert(entities).values({
        canonicalName,
        createdAt: now,
        id: entity.id,
        name: input.name,
        propertiesJson: input.properties
            ? JSON.stringify(input.properties)
            : null,
        summary: input.summary ?? null,
        type: input.type,
        updatedAt: now,
    })
    await addAliases(entity.id, input.aliases ?? [], now)

    return entity
}

async function addAliases(
    entityId: string,
    aliases: string[],
    createdAt: string,
): Promise<void> {
    const db = await getDb()
    for (const alias of aliases) {
        await db.insert(entityAliases).values({
            createdAt,
            entityId,
            id: `alias_${randomUUID()}`,
            normalizedValue: normalizeEntityName(alias),
            value: alias,
        })
    }
}

function normalizeEntityName(name: string): string {
    return name.trim().toLowerCase().replaceAll(/\s+/gu, ' ')
}

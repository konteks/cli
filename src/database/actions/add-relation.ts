import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { relations } from '@/database/schema'
import getDb from './_db'

type RelationRecord = {
    id: string
    subjectId: string
    predicate: string
    objectId: string
    confidence: number
    status: 'active' | 'invalidated' | 'superseded'
    validFrom?: string
    validTo?: string
}

export default async function addRelation(input: {
    subjectId: string
    predicate: string
    objectId: string
    confidence?: number
    validFrom?: string
    validTo?: string
    supersedesRelationId?: string
    properties?: Record<string, unknown>
}): Promise<RelationRecord> {
    const db = await getDb()
    const relation: RelationRecord = {
        confidence: input.confidence ?? 1,
        id: `rel_${randomUUID()}`,
        objectId: input.objectId,
        predicate: input.predicate,
        status: 'active',
        subjectId: input.subjectId,
        validFrom: input.validFrom,
        validTo: input.validTo,
    }
    const now = new Date().toISOString()

    if (input.supersedesRelationId) {
        await db
            .update(relations)
            .set({ status: 'superseded', updatedAt: now })
            .where(eq(relations.id, input.supersedesRelationId))
    }

    await db.insert(relations).values({
        confidence: relation.confidence,
        createdAt: now,
        id: relation.id,
        objectId: input.objectId,
        predicate: input.predicate,
        propertiesJson: input.properties
            ? JSON.stringify(input.properties)
            : null,
        status: relation.status,
        subjectId: input.subjectId,
        supersedesRelationId: input.supersedesRelationId ?? null,
        updatedAt: now,
        validFrom: input.validFrom ?? null,
        validTo: input.validTo ?? null,
    })

    return relation
}

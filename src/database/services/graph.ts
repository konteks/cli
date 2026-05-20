import addRelationAction from '@/database/actions/add-relation'
import findEntityByCanonicalNameAction from '@/database/actions/find-entity-by-canonical-name'
import findPathAction from '@/database/actions/find-path'
import historicalRelationsAction from '@/database/actions/historical-relations'
import invalidateRelationAction from '@/database/actions/invalidate-relation'
import searchEntitiesAction from '@/database/actions/search-entities'
import traverseNeighborsAction from '@/database/actions/traverse-neighbors'
import upsertEntityAction from '@/database/actions/upsert-entity'

export type EntityInput = {
    type: string
    name: string
    summary?: string
    aliases?: string[]
    properties?: Record<string, unknown>
}

export type EntityRecord = {
    id: string
    type: string
    name: string
    canonicalName: string
    summary?: string
}

export type RelationInput = {
    subjectId: string
    predicate: string
    objectId: string
    confidence?: number
    validFrom?: string
    validTo?: string
    supersedesRelationId?: string
    properties?: Record<string, unknown>
}

export type RelationRecord = {
    id: string
    subjectId: string
    predicate: string
    objectId: string
    confidence: number
    status: 'active' | 'invalidated' | 'superseded'
    validFrom?: string
    validTo?: string
}

export type GraphNeighbor = {
    depth: number
    relationId: string
    predicate: string
    direction: 'incoming' | 'outgoing'
    entity: EntityRecord
}

export type HistoricalRelation = {
    relationId: string
    predicate: string
    status: 'invalidated' | 'superseded'
    validFrom?: string
    validTo?: string
    subject: EntityRecord
    object: EntityRecord
}

export type GraphPathStep = {
    depth: number
    relationId: string
    fromEntityId: string
    predicate: string
    toEntityId: string
}

export const upsertEntity = upsertEntityAction
export const findEntityByCanonicalName = findEntityByCanonicalNameAction
export const searchEntities = searchEntitiesAction
export const addRelation = addRelationAction
export const invalidateRelation = invalidateRelationAction
export const traverseNeighbors = traverseNeighborsAction
export const historicalRelations = historicalRelationsAction
export const findPath = findPathAction

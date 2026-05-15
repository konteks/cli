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

export type EntityRow = {
    id: string
    type: string
    name: string
    canonical_name: string
    summary: string | null
}

export type EntitySearchRow = EntityRow & {
    score: number
}

export type NeighborRow = EntityRow & {
    depth: number
    relation_id: string
    predicate: string
    direction: 'incoming' | 'outgoing'
}

export type HistoricalRelationRow = {
    relation_id: string
    predicate: string
    status: 'invalidated' | 'superseded'
    valid_from: string | null
    valid_to: string | null
    subject_id: string
    subject_type: string
    subject_name: string
    subject_canonical_name: string
    subject_summary: string | null
    object_id: string
    object_type: string
    object_name: string
    object_canonical_name: string
    object_summary: string | null
}

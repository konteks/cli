import historicalRelationsAction from '@/database/actions/historical-relations'
import searchEntitiesAction from '@/database/actions/search-entities'
import traverseNeighborsAction from '@/database/actions/traverse-neighbors'

export type EntityRecord = {
    id: string
    type: string
    name: string
    canonicalName: string
    summary?: string
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

export const searchEntities = searchEntitiesAction
export const traverseNeighbors = traverseNeighborsAction
export const historicalRelations = historicalRelationsAction

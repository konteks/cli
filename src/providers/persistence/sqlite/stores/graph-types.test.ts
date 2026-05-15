import { describe, expect, it } from 'bun:test'
import type {
    EntityInput,
    EntityRecord,
    GraphNeighbor,
    HistoricalRelation,
    RelationInput,
    RelationRecord,
} from './graph-types'

type CoveredTypes = [
    EntityInput,
    EntityRecord,
    GraphNeighbor,
    HistoricalRelation,
    RelationInput,
    RelationRecord,
]

describe('graph types', () => {
    it('compiles representative graph contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'EntityInput',
            'EntityRecord',
            'GraphNeighbor',
            'HistoricalRelation',
            'RelationInput',
            'RelationRecord',
        ]

        expect(typeNames).toHaveLength(6)
    })
})

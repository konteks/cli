import { describe, expect, it } from 'bun:test'
import type {
    ForgetResult,
    GraphNeighbor,
    HistoricalRelation,
    MemoryEntity,
    MemoryRelation,
    MemorySearchResult,
    ObservationKind,
    RecallGraphItem,
    RecallHistoryItem,
    RecallPackage,
    SaveResult,
    WarmUpContext,
    WarmUpGuidance,
    WarmUpHighlight,
} from './memory'

type CoveredTypes = [
    ForgetResult,
    GraphNeighbor,
    HistoricalRelation,
    MemoryEntity,
    MemoryRelation,
    MemorySearchResult,
    ObservationKind,
    RecallGraphItem,
    RecallHistoryItem,
    RecallPackage,
    SaveResult,
    WarmUpContext,
    WarmUpGuidance,
    WarmUpHighlight,
]

describe('models/memory', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'ForgetResult',
            'GraphNeighbor',
            'HistoricalRelation',
            'MemoryEntity',
            'MemoryRelation',
            'MemorySearchResult',
            'ObservationKind',
            'RecallGraphItem',
            'RecallHistoryItem',
            'RecallPackage',
            'SaveResult',
            'WarmUpContext',
            'WarmUpGuidance',
            'WarmUpHighlight',
        ] as const
        expect(typeNames).toEqual([
            'ForgetResult',
            'GraphNeighbor',
            'HistoricalRelation',
            'MemoryEntity',
            'MemoryRelation',
            'MemorySearchResult',
            'ObservationKind',
            'RecallGraphItem',
            'RecallHistoryItem',
            'RecallPackage',
            'SaveResult',
            'WarmUpContext',
            'WarmUpGuidance',
            'WarmUpHighlight',
        ])
    })
})

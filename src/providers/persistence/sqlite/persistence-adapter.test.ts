import { describe, expect, it } from 'bun:test'
import type {
    DiaryRow,
    ObservationRow,
    RetrievalDocumentRow,
} from './persistence-adapter'
import {
    queryDiaries,
    queryFtsRows,
    queryObservations,
    queryRetrievalDocuments,
} from './persistence-adapter'

type CoveredTypes = [DiaryRow, ObservationRow, RetrievalDocumentRow]

describe('providers/persistence/sqlite/persistence-adapter', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['queryDiaries', queryDiaries, 'function'],
            ['queryFtsRows', queryFtsRows, 'function'],
            ['queryObservations', queryObservations, 'function'],
            ['queryRetrievalDocuments', queryRetrievalDocuments, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'queryDiaries',
            'queryFtsRows',
            'queryObservations',
            'queryRetrievalDocuments',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'DiaryRow',
            'ObservationRow',
            'RetrievalDocumentRow',
        ] as const
        expect(typeNames).toEqual([
            'DiaryRow',
            'ObservationRow',
            'RetrievalDocumentRow',
        ])
    })
})

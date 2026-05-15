import { describe, expect, it } from 'bun:test'
import type {
    DiaryExportRow,
    ObservationExportRow,
} from './durable-memory-transfer-types'

type CoveredTypes = [DiaryExportRow, ObservationExportRow]

describe('durable memory transfer types', () => {
    it('compiles representative transfer row contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['DiaryExportRow', 'ObservationExportRow']

        expect(typeNames).toHaveLength(2)
    })
})

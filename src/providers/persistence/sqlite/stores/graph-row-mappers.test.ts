import { describe, expect, it } from 'bun:test'
import { entityFromHistoricalRow, entityFromRow } from './graph-row-mappers'
import type { HistoricalRelationRow } from './graph-types'

describe('graph row mappers', () => {
    it('maps entity rows and nullable summaries', () => {
        expect(
            entityFromRow({
                canonical_name: 'konteks',
                id: 'ent_1',
                name: 'Konteks',
                summary: null,
                type: 'project',
            }),
        ).toEqual({
            canonicalName: 'konteks',
            id: 'ent_1',
            name: 'Konteks',
            summary: undefined,
            type: 'project',
        })
    })

    it('maps historical relation subject and object rows', () => {
        const row: HistoricalRelationRow = {
            object_canonical_name: 'bun',
            object_id: 'ent_bun',
            object_name: 'Bun',
            object_summary: 'Runtime',
            object_type: 'runtime',
            predicate: 'prefers_runtime',
            relation_id: 'rel_1',
            status: 'superseded',
            subject_canonical_name: 'konteks',
            subject_id: 'ent_konteks',
            subject_name: 'Konteks',
            subject_summary: null,
            subject_type: 'project',
            valid_from: null,
            valid_to: null,
        }

        expect(entityFromHistoricalRow(row, 'subject')).toMatchObject({
            canonicalName: 'konteks',
            id: 'ent_konteks',
            summary: undefined,
        })
        expect(entityFromHistoricalRow(row, 'object')).toMatchObject({
            canonicalName: 'bun',
            id: 'ent_bun',
            summary: 'Runtime',
        })
    })
})

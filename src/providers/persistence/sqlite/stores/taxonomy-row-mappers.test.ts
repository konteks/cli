import { describe, expect, it } from 'bun:test'
import {
    taxonomyLinkFromRow,
    taxonomyNodeFromRow,
} from './taxonomy-row-mappers'

describe('taxonomy row mappers', () => {
    it('maps nullable taxonomy node rows', () => {
        expect(
            taxonomyNodeFromRow({
                id: 'tax_1',
                name: 'Root',
                parent_id: null,
                summary: null,
            }),
        ).toEqual({
            id: 'tax_1',
            name: 'Root',
            parentId: undefined,
            summary: undefined,
        })
    })

    it('maps taxonomy link rows to public shape', () => {
        expect(
            taxonomyLinkFromRow({
                id: 'taxlink_1',
                node_id: 'tax_1',
                target_id: 'obs_1',
                target_type: 'observation',
            }),
        ).toEqual({
            id: 'taxlink_1',
            nodeId: 'tax_1',
            targetId: 'obs_1',
            targetType: 'observation',
        })
    })
})

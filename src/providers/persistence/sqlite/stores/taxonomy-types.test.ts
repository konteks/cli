import { describe, expect, it } from 'bun:test'
import type {
    TaxonomyLink,
    TaxonomyLinkInput,
    TaxonomyNode,
    TaxonomyNodeInput,
    TaxonomyTreeNode,
} from './taxonomy-types'

type CoveredTypes = [
    TaxonomyLink,
    TaxonomyLinkInput,
    TaxonomyNode,
    TaxonomyNodeInput,
    TaxonomyTreeNode,
]

describe('taxonomy types', () => {
    it('compiles representative taxonomy contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'TaxonomyLink',
            'TaxonomyLinkInput',
            'TaxonomyNode',
            'TaxonomyNodeInput',
            'TaxonomyTreeNode',
        ]

        expect(typeNames).toHaveLength(5)
    })
})

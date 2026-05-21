import linkTaxonomyTargetAction from '@/database/actions/link-taxonomy-target'
import upsertTaxonomyNodeAction from '@/database/actions/upsert-taxonomy-node'

export type TaxonomyNodeInput = {
    parentId?: string
    name: string
    summary?: string
}

export type TaxonomyNode = {
    id: string
    parentId?: string
    name: string
    summary?: string
}

export type TaxonomyLinkInput = {
    nodeId: string
    targetType: string
    targetId: string
}

export type TaxonomyLink = TaxonomyLinkInput & {
    id: string
}

export const upsertNode = upsertTaxonomyNodeAction
export const linkTarget = linkTaxonomyTargetAction

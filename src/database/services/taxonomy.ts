import getTaxonomyPathAction from '@/database/actions/get-taxonomy-path'
import getTaxonomySubtreeAction from '@/database/actions/get-taxonomy-subtree'
import linkTaxonomyTargetAction from '@/database/actions/link-taxonomy-target'
import listTaxonomyLinksAction from '@/database/actions/list-taxonomy-links'
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

export type TaxonomyTreeNode = TaxonomyNode & {
    depth: number
}

export const upsertNode = upsertTaxonomyNodeAction
export const linkTarget = linkTaxonomyTargetAction
export const listLinks = listTaxonomyLinksAction
export const getSubtree = getTaxonomySubtreeAction
export const getPath = getTaxonomyPathAction

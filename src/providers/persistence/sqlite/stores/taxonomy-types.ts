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

export type TaxonomyNodeRow = {
    id: string
    parent_id: string | null
    name: string
    summary: string | null
}

export type TaxonomyTreeRow = TaxonomyNodeRow & {
    depth: number
}

export type TaxonomyLinkRow = {
    id: string
    node_id: string
    target_type: string
    target_id: string
}

export type TaxonomyPathRow = {
    id_path: string
    name_path: string
}

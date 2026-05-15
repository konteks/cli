import type { SqliteAdapter } from '../sqlite-adapter'
import TaxonomyLinkStore from './taxonomy-link-store'
import TaxonomyNodeStore from './taxonomy-node-store'
import TaxonomyTreeStore from './taxonomy-tree-store'
import type {
    TaxonomyLink,
    TaxonomyLinkInput,
    TaxonomyNode,
    TaxonomyNodeInput,
    TaxonomyTreeNode,
} from './taxonomy-types'

export default class TaxonomyStore {
    private readonly links: TaxonomyLinkStore
    private readonly nodes: TaxonomyNodeStore
    private readonly tree: TaxonomyTreeStore

    constructor(adapter: SqliteAdapter) {
        this.links = new TaxonomyLinkStore(adapter)
        this.nodes = new TaxonomyNodeStore(adapter)
        this.tree = new TaxonomyTreeStore(adapter)
    }

    async upsertNode(input: TaxonomyNodeInput): Promise<TaxonomyNode> {
        return this.nodes.upsertNode(input)
    }

    async linkTarget(input: TaxonomyLinkInput): Promise<TaxonomyLink> {
        return this.links.linkTarget(input)
    }

    async listLinks(nodeId: string): Promise<TaxonomyLink[]> {
        return this.links.listLinks(nodeId)
    }

    async getSubtree(
        rootId?: string,
        options: { maxDepth?: number } = {},
    ): Promise<TaxonomyTreeNode[]> {
        return this.tree.getSubtree(rootId, options)
    }

    async getPath(nodeId: string): Promise<TaxonomyNode[]> {
        return this.tree.getPath(nodeId)
    }
}

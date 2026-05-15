import type { KonteksDatabase, SqliteAdapter } from '../sqlite-adapter'
import GraphEntityStore from './graph-entity-store'
import GraphRelationStore from './graph-relation-store'
import GraphTraversalStore from './graph-traversal-store'
import type {
    EntityInput,
    EntityRecord,
    GraphNeighbor,
    HistoricalRelation,
    RelationInput,
    RelationRecord,
} from './graph-types'
import type { GraphPathStep } from './graph-utils'

export default class GraphStore {
    private readonly entities: GraphEntityStore
    private readonly relations: GraphRelationStore
    private readonly traversal: GraphTraversalStore

    constructor(
        adapter: SqliteAdapter | { adapter: SqliteAdapter },
        _db?: KonteksDatabase,
    ) {
        const sqliteAdapter = 'adapter' in adapter ? adapter.adapter : adapter
        this.entities = new GraphEntityStore(sqliteAdapter)
        this.relations = new GraphRelationStore(sqliteAdapter)
        this.traversal = new GraphTraversalStore(sqliteAdapter)
    }

    async upsertEntity(input: EntityInput): Promise<EntityRecord> {
        return this.entities.upsertEntity(input)
    }

    async findEntityByCanonicalName(
        canonicalName: string,
    ): Promise<EntityRecord | undefined> {
        return this.entities.findEntityByCanonicalName(canonicalName)
    }

    async searchEntities(
        query: string,
        options: { limit?: number } = {},
    ): Promise<EntityRecord[]> {
        return this.entities.searchEntities(query, options)
    }

    async addRelation(input: RelationInput): Promise<RelationRecord> {
        return this.relations.addRelation(input)
    }

    async invalidateRelation(id: string, validTo?: string): Promise<void> {
        return this.relations.invalidateRelation(id, validTo)
    }

    async traverseNeighbors(
        entityId: string,
        options: { maxDepth?: number; limit?: number } = {},
    ): Promise<GraphNeighbor[]> {
        return this.traversal.traverseNeighbors(entityId, options)
    }

    async historicalRelations(
        entityId: string,
        options: { limit?: number } = {},
    ): Promise<HistoricalRelation[]> {
        return this.traversal.historicalRelations(entityId, options)
    }

    async findPath(
        fromEntityId: string,
        toEntityId: string,
        maxDepth = 3,
    ): Promise<GraphPathStep[]> {
        return this.traversal.findPath(fromEntityId, toEntityId, maxDepth)
    }
}

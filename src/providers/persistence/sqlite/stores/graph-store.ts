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

    public constructor(
        adapter: SqliteAdapter | { adapter: SqliteAdapter },
        _db?: KonteksDatabase,
    ) {
        const sqliteAdapter = 'adapter' in adapter ? adapter.adapter : adapter
        this.entities = new GraphEntityStore(sqliteAdapter)
        this.relations = new GraphRelationStore(sqliteAdapter)
        this.traversal = new GraphTraversalStore(sqliteAdapter)
    }

    public async upsertEntity(input: EntityInput): Promise<EntityRecord> {
        return this.entities.upsertEntity(input)
    }

    public async findEntityByCanonicalName(
        canonicalName: string,
    ): Promise<EntityRecord | undefined> {
        return this.entities.findEntityByCanonicalName(canonicalName)
    }

    public async searchEntities(
        query: string,
        options: { limit?: number } = {},
    ): Promise<EntityRecord[]> {
        return this.entities.searchEntities(query, options)
    }

    public async addRelation(input: RelationInput): Promise<RelationRecord> {
        return this.relations.addRelation(input)
    }

    public async invalidateRelation(
        id: string,
        validTo?: string,
    ): Promise<void> {
        return this.relations.invalidateRelation(id, validTo)
    }

    public async traverseNeighbors(
        entityId: string,
        options: { maxDepth?: number; limit?: number } = {},
    ): Promise<GraphNeighbor[]> {
        return this.traversal.traverseNeighbors(entityId, options)
    }

    public async historicalRelations(
        entityId: string,
        options: { limit?: number } = {},
    ): Promise<HistoricalRelation[]> {
        return this.traversal.historicalRelations(entityId, options)
    }

    public async findPath(
        fromEntityId: string,
        toEntityId: string,
        maxDepth = 3,
    ): Promise<GraphPathStep[]> {
        return this.traversal.findPath(fromEntityId, toEntityId, maxDepth)
    }
}

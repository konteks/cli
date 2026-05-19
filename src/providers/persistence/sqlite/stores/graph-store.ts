import type { KonteksDatabase, SqliteExecutor } from '../libsql-helpers'
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
        client: SqliteExecutor | { client: SqliteExecutor },
        _db?: KonteksDatabase,
    ) {
        const sqliteClient = 'client' in client ? client.client : client
        this.entities = new GraphEntityStore(sqliteClient)
        this.relations = new GraphRelationStore(sqliteClient)
        this.traversal = new GraphTraversalStore(sqliteClient)
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

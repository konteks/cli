import * as graph from '@/database/services/graph'
import * as taxonomy from '@/database/services/taxonomy'
import {
    type SqliteConnection,
    withTransaction,
} from '@/providers/persistence/sqlite/database'

export function graphApi(connection: SqliteConnection) {
    return {
        addRelation: (input: Parameters<typeof graph.addRelation>[0]) =>
            withTransaction(connection, () => graph.addRelation(input)),
        findEntityByCanonicalName: (
            name: Parameters<typeof graph.findEntityByCanonicalName>[0],
        ) =>
            withTransaction(connection, () =>
                graph.findEntityByCanonicalName(name),
            ),
        findPath: (
            fromEntityId: Parameters<typeof graph.findPath>[0],
            toEntityId: Parameters<typeof graph.findPath>[1],
            maxDepth?: Parameters<typeof graph.findPath>[2],
        ) =>
            withTransaction(connection, () =>
                graph.findPath(fromEntityId, toEntityId, maxDepth),
            ),
        historicalRelations: (
            entityId: Parameters<typeof graph.historicalRelations>[0],
            options?: Parameters<typeof graph.historicalRelations>[1],
        ) =>
            withTransaction(connection, () =>
                graph.historicalRelations(entityId, options),
            ),
        invalidateRelation: (
            id: Parameters<typeof graph.invalidateRelation>[0],
        ) => withTransaction(connection, () => graph.invalidateRelation(id)),
        searchEntities: (
            query: Parameters<typeof graph.searchEntities>[0],
            options?: Parameters<typeof graph.searchEntities>[1],
        ) =>
            withTransaction(connection, () =>
                graph.searchEntities(query, options),
            ),
        traverseNeighbors: (
            entityId: Parameters<typeof graph.traverseNeighbors>[0],
            options?: Parameters<typeof graph.traverseNeighbors>[1],
        ) =>
            withTransaction(connection, () =>
                graph.traverseNeighbors(entityId, options),
            ),
        upsertEntity: (input: Parameters<typeof graph.upsertEntity>[0]) =>
            withTransaction(connection, () => graph.upsertEntity(input)),
    }
}

export function taxonomyApi(connection: SqliteConnection) {
    return {
        getPath: (nodeId: Parameters<typeof taxonomy.getPath>[0]) =>
            withTransaction(connection, () => taxonomy.getPath(nodeId)),
        getSubtree: (
            rootId?: Parameters<typeof taxonomy.getSubtree>[0],
            options?: Parameters<typeof taxonomy.getSubtree>[1],
        ) =>
            withTransaction(connection, () =>
                taxonomy.getSubtree(rootId, options),
            ),
        linkTarget: (input: Parameters<typeof taxonomy.linkTarget>[0]) =>
            withTransaction(connection, () => taxonomy.linkTarget(input)),
        listLinks: (nodeId: Parameters<typeof taxonomy.listLinks>[0]) =>
            withTransaction(connection, () => taxonomy.listLinks(nodeId)),
        upsertNode: (input: Parameters<typeof taxonomy.upsertNode>[0]) =>
            withTransaction(connection, () => taxonomy.upsertNode(input)),
    }
}

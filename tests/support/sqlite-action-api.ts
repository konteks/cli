import { withTransaction } from '@/database/actions/_db'
import * as graph from '@/database/services/graph'
import * as taxonomy from '@/database/services/taxonomy'

export function graphApi(_connection?: unknown) {
    return {
        addRelation: (input: Parameters<typeof graph.addRelation>[0]) =>
            withTransaction(() => graph.addRelation(input)),
        findEntityByCanonicalName: (
            name: Parameters<typeof graph.findEntityByCanonicalName>[0],
        ) => withTransaction(() => graph.findEntityByCanonicalName(name)),
        findPath: (
            fromEntityId: Parameters<typeof graph.findPath>[0],
            toEntityId: Parameters<typeof graph.findPath>[1],
            maxDepth?: Parameters<typeof graph.findPath>[2],
        ) =>
            withTransaction(() =>
                graph.findPath(fromEntityId, toEntityId, maxDepth),
            ),
        historicalRelations: (
            entityId: Parameters<typeof graph.historicalRelations>[0],
            options?: Parameters<typeof graph.historicalRelations>[1],
        ) =>
            withTransaction(() => graph.historicalRelations(entityId, options)),
        invalidateRelation: (
            id: Parameters<typeof graph.invalidateRelation>[0],
        ) => withTransaction(() => graph.invalidateRelation(id)),
        searchEntities: (
            query: Parameters<typeof graph.searchEntities>[0],
            options?: Parameters<typeof graph.searchEntities>[1],
        ) => withTransaction(() => graph.searchEntities(query, options)),
        traverseNeighbors: (
            entityId: Parameters<typeof graph.traverseNeighbors>[0],
            options?: Parameters<typeof graph.traverseNeighbors>[1],
        ) => withTransaction(() => graph.traverseNeighbors(entityId, options)),
        upsertEntity: (input: Parameters<typeof graph.upsertEntity>[0]) =>
            withTransaction(() => graph.upsertEntity(input)),
    }
}

export function taxonomyApi(_connection?: unknown) {
    return {
        getPath: (nodeId: Parameters<typeof taxonomy.getPath>[0]) =>
            withTransaction(() => taxonomy.getPath(nodeId)),
        getSubtree: (
            rootId?: Parameters<typeof taxonomy.getSubtree>[0],
            options?: Parameters<typeof taxonomy.getSubtree>[1],
        ) => withTransaction(() => taxonomy.getSubtree(rootId, options)),
        linkTarget: (input: Parameters<typeof taxonomy.linkTarget>[0]) =>
            withTransaction(() => taxonomy.linkTarget(input)),
        listLinks: (nodeId: Parameters<typeof taxonomy.listLinks>[0]) =>
            withTransaction(() => taxonomy.listLinks(nodeId)),
        upsertNode: (input: Parameters<typeof taxonomy.upsertNode>[0]) =>
            withTransaction(() => taxonomy.upsertNode(input)),
    }
}

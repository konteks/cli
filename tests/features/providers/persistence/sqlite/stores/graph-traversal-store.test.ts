import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import GraphEntityStore from '@/providers/persistence/sqlite/stores/graph-entity-store'
import GraphRelationStore from '@/providers/persistence/sqlite/stores/graph-relation-store'
import GraphTraversalStore from '@/providers/persistence/sqlite/stores/graph-traversal-store'
import { loadProjectContext } from '@/providers/project/context'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

async function withProjectRoot<T>(
    projectRoot: string,
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(projectRoot)

    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}

describe('GraphTraversalStore', () => {
    it('traverses neighbors, historical relations, and directed paths', async () => {
        const graph = await makeGraphTraversalStore()
        try {
            const project = await graph.entities.upsertEntity({
                name: 'Konteks',
                type: 'project',
            })
            const sqlite = await graph.entities.upsertEntity({
                name: 'SQLite',
                type: 'technology',
            })
            const wasm = await graph.entities.upsertEntity({
                name: 'WASM',
                type: 'technology',
            })
            const oldRuntime = await graph.entities.upsertEntity({
                name: 'Node',
                type: 'runtime',
            })
            const uses = await graph.relations.addRelation({
                objectId: sqlite.id,
                predicate: 'uses',
                subjectId: project.id,
            })
            await graph.relations.addRelation({
                objectId: wasm.id,
                predicate: 'compiled_to',
                subjectId: sqlite.id,
            })
            await graph.relations.addRelation({
                objectId: oldRuntime.id,
                predicate: 'previously_used',
                subjectId: project.id,
            })
            await graph.relations.invalidateRelation(uses.id)

            const neighbors = await graph.traversal.traverseNeighbors(
                project.id,
                { maxDepth: 2 },
            )
            const historical = await graph.traversal.historicalRelations(
                project.id,
            )
            const path = await graph.traversal.findPath(project.id, wasm.id, 3)

            expect(neighbors.map(neighbor => neighbor.entity.name)).toEqual([
                'Node',
            ])
            expect(historical.map(relation => relation.relationId)).toEqual([
                uses.id,
            ])
            expect(path).toEqual([])
        } finally {
            await graph.close()
        }
    })

    it('finds an active directed path', async () => {
        const graph = await makeGraphTraversalStore()
        try {
            const a = await graph.entities.upsertEntity({
                name: 'A',
                type: 'node',
            })
            const b = await graph.entities.upsertEntity({
                name: 'B',
                type: 'node',
            })
            const c = await graph.entities.upsertEntity({
                name: 'C',
                type: 'node',
            })
            await graph.relations.addRelation({
                objectId: b.id,
                predicate: 'depends_on',
                subjectId: a.id,
            })
            await graph.relations.addRelation({
                objectId: c.id,
                predicate: 'enables',
                subjectId: b.id,
            })

            const path = await graph.traversal.findPath(a.id, c.id, 3)

            expect(path.map(step => step.predicate)).toEqual([
                'depends_on',
                'enables',
            ])
        } finally {
            await graph.close()
        }
    })
})

async function makeGraphTraversalStore(): Promise<{
    close: () => Promise<void>
    entities: GraphEntityStore
    relations: GraphRelationStore
    traversal: GraphTraversalStore
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-traversal-test-'))
    tempDirs.push(projectRoot)
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const service = await openProjectDatabase(context)

    return {
        close: () => service.close(),
        entities: new GraphEntityStore(service.adapter),
        relations: new GraphRelationStore(service.adapter),
        traversal: new GraphTraversalStore(service.adapter),
    }
}

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '../../../file-system/context.js'
import { openProjectDatabase } from '../database.js'
import { GraphStore } from './graph-store.js'

const tempDirs: string[] = []

async function makeGraphStore(): Promise<{
    close: () => Promise<void>
    store: GraphStore
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-graph-test-'))
    tempDirs.push(projectRoot)
    const context = await loadProjectContext(projectRoot)
    const service = await openProjectDatabase(context)

    return {
        close: () => service.close(),
        store: new GraphStore(service.adapter, service.db),
    }
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('GraphStore', () => {
    it('upserts entities by canonical name', async () => {
        const graph = await makeGraphStore()

        const first = await graph.store.upsertEntity({
            aliases: ['Konteks MCP'],
            name: 'Konteks',
            summary: 'Local memory system',
            type: 'project',
        })
        const second = await graph.store.upsertEntity({
            name: ' konteks ',
            summary: 'Updated summary',
            type: 'project',
        })

        expect(second.id).toBe(first.id)
        expect(second.summary).toBe('Updated summary')
        await graph.close()
    })

    it('traverses active incoming and outgoing neighbors with bounded depth', async () => {
        const graph = await makeGraphStore()
        const project = await graph.store.upsertEntity({
            name: 'Konteks',
            type: 'project',
        })
        const sqlite = await graph.store.upsertEntity({
            name: 'SQLite',
            type: 'technology',
        })
        const wasm = await graph.store.upsertEntity({
            name: 'WASM',
            type: 'technology',
        })
        await graph.store.addRelation({
            objectId: sqlite.id,
            predicate: 'uses',
            subjectId: project.id,
        })
        await graph.store.addRelation({
            objectId: wasm.id,
            predicate: 'compiled_to',
            subjectId: sqlite.id,
        })

        const neighbors = await graph.store.traverseNeighbors(project.id, {
            maxDepth: 2,
        })

        expect(neighbors.map(neighbor => neighbor.entity.name)).toEqual([
            'SQLite',
            'WASM',
        ])
        expect(neighbors.map(neighbor => neighbor.depth)).toEqual([1, 2])
        await graph.close()
    })

    it('searches entities by name, summary, and aliases', async () => {
        const graph = await makeGraphStore()
        await graph.store.upsertEntity({
            aliases: ['Project Context Memory'],
            name: 'Konteks',
            summary: 'Local memory system for coding agents',
            type: 'project',
        })

        const byAlias = await graph.store.searchEntities('context memory')
        const bySummary = await graph.store.searchEntities('coding agents')

        expect(byAlias[0]?.name).toBe('Konteks')
        expect(bySummary[0]?.name).toBe('Konteks')
        await graph.close()
    })

    it('finds a small directed path with a recursive CTE', async () => {
        const graph = await makeGraphStore()
        const a = await graph.store.upsertEntity({ name: 'A', type: 'node' })
        const b = await graph.store.upsertEntity({ name: 'B', type: 'node' })
        const c = await graph.store.upsertEntity({ name: 'C', type: 'node' })
        await graph.store.addRelation({
            objectId: b.id,
            predicate: 'depends_on',
            subjectId: a.id,
        })
        await graph.store.addRelation({
            objectId: c.id,
            predicate: 'enables',
            subjectId: b.id,
        })

        const path = await graph.store.findPath(a.id, c.id, 3)

        expect(path.map(step => step.predicate)).toEqual([
            'depends_on',
            'enables',
        ])
        expect(path[0]?.fromEntityId).toBe(a.id)
        expect(path.at(-1)?.toEntityId).toBe(c.id)
        await graph.close()
    })

    it('invalidates and supersedes relations so traversal only sees current facts', async () => {
        const graph = await makeGraphStore()
        const project = await graph.store.upsertEntity({
            name: 'Konteks',
            type: 'project',
        })
        const oldRuntime = await graph.store.upsertEntity({
            name: 'Node',
            type: 'runtime',
        })
        const newRuntime = await graph.store.upsertEntity({
            name: 'Bun',
            type: 'runtime',
        })
        const oldRelation = await graph.store.addRelation({
            objectId: oldRuntime.id,
            predicate: 'prefers_runtime',
            subjectId: project.id,
        })
        await graph.store.addRelation({
            objectId: newRuntime.id,
            predicate: 'prefers_runtime',
            subjectId: project.id,
            supersedesRelationId: oldRelation.id,
        })
        await graph.store.invalidateRelation(oldRelation.id)

        const neighbors = await graph.store.traverseNeighbors(project.id)

        expect(neighbors.map(neighbor => neighbor.entity.name)).toEqual(['Bun'])
        await graph.close()
    })
})

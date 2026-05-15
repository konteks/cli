import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '@/providers/project/context'
import { openProjectDatabase } from '../database'
import GraphEntityStore from './graph-entity-store'
import GraphRelationStore from './graph-relation-store'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('GraphRelationStore', () => {
    it('adds, supersedes, and invalidates relations', async () => {
        const graph = await makeGraphRelationStore()
        try {
            const project = await graph.entities.upsertEntity({
                name: 'Konteks',
                type: 'project',
            })
            const node = await graph.entities.upsertEntity({
                name: 'Node',
                type: 'runtime',
            })
            const bun = await graph.entities.upsertEntity({
                name: 'Bun',
                type: 'runtime',
            })
            const oldRelation = await graph.relations.addRelation({
                objectId: node.id,
                predicate: 'prefers_runtime',
                subjectId: project.id,
            })
            const newRelation = await graph.relations.addRelation({
                objectId: bun.id,
                predicate: 'prefers_runtime',
                subjectId: project.id,
                supersedesRelationId: oldRelation.id,
            })
            await graph.relations.invalidateRelation(newRelation.id)

            const rows = await graph.queryRelations()

            expect(rows).toEqual([
                { id: oldRelation.id, status: 'superseded' },
                { id: newRelation.id, status: 'invalidated' },
            ])
        } finally {
            await graph.close()
        }
    })
})

async function makeGraphRelationStore(): Promise<{
    close: () => Promise<void>
    entities: GraphEntityStore
    queryRelations: () => Promise<Array<{ id: string; status: string }>>
    relations: GraphRelationStore
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-relation-test-'))
    tempDirs.push(projectRoot)
    const context = await loadProjectContext(projectRoot)
    const service = await openProjectDatabase(context)

    return {
        close: () => service.close(),
        entities: new GraphEntityStore(service.adapter),
        queryRelations: () =>
            service.adapter.query<{ id: string; status: string }>(
                'select id, status from relations order by created_at',
            ),
        relations: new GraphRelationStore(service.adapter),
    }
}

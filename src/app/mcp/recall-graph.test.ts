import { afterEach, describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RecallMemoryAction } from '@/app/actions/recall-memory-action'
import { openProjectDatabase } from '@/app/database/sqlite/database'
import { SQLiteMemoryRepository } from '@/app/database/sqlite/sqlite-memory-repository'
import { GraphStore } from '@/app/database/sqlite/stores/graph-store'
import { loadProjectContext } from '@/app/file-system/context'
import { mkdtemp, rm } from '@/app/support/file-manager'

const tempDirs: string[] = []

async function makeGraph() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-recall-graph-'))
    tempDirs.push(projectRoot)
    const context = await loadProjectContext(projectRoot)
    const adapter = await openProjectDatabase(context)
    return {
        adapter,
        context,
        graph: new GraphStore(adapter),
    }
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('recallGraph', () => {
    it('returns compact active graph context for task-matched entities', async () => {
        const { adapter, context, graph } = await makeGraph()
        const project = await graph.upsertEntity({
            aliases: ['memory system'],
            name: 'Konteks',
            type: 'project',
        })
        const oldRuntime = await graph.upsertEntity({
            name: 'Node',
            type: 'runtime',
        })
        const currentRuntime = await graph.upsertEntity({
            name: 'Bun',
            type: 'runtime',
        })
        const oldRelation = await graph.addRelation({
            objectId: oldRuntime.id,
            predicate: 'prefers_runtime',
            subjectId: project.id,
        })
        await graph.addRelation({
            objectId: currentRuntime.id,
            predicate: 'prefers_runtime',
            subjectId: project.id,
            supersedesRelationId: oldRelation.id,
        })

        const repo = new SQLiteMemoryRepository(adapter, context)
        const action = new RecallMemoryAction(repo)
        const recall = await action.execute({ task: 'memory system runtime' })
        const items = recall.graph

        expect(items.map(item => item.relatedEntityName)).toContain('Bun')
        expect(items.map(item => item.relatedEntityName)).not.toContain('Node')
        expect(items[0]).toMatchObject({
            depth: 1,
            entityName: 'Konteks',
            predicate: 'prefers_runtime',
        })
        await adapter.close()
    })

    it('only returns historical graph context when the task asks for it', async () => {
        const { adapter, context, graph } = await makeGraph()
        const project = await graph.upsertEntity({
            aliases: ['memory system'],
            name: 'Konteks',
            type: 'project',
        })
        const oldStorage = await graph.upsertEntity({
            name: 'Global Memory',
            type: 'storage',
        })
        const currentStorage = await graph.upsertEntity({
            name: '.konteks',
            type: 'storage',
        })
        const oldRelation = await graph.addRelation({
            objectId: oldStorage.id,
            predicate: 'stores_in',
            subjectId: project.id,
        })
        await graph.addRelation({
            objectId: currentStorage.id,
            predicate: 'stores_in',
            subjectId: project.id,
            supersedesRelationId: oldRelation.id,
        })

        const repo = new SQLiteMemoryRepository(adapter, context)
        const action = new RecallMemoryAction(repo)

        const normalRecall = await action.execute({
            task: 'work on memory system',
        })
        const normal = normalRecall.history

        const historicalRecall = await action.execute({
            task: 'why did the previous memory system storage decision change',
        })
        const historical = historicalRecall.history

        expect(normal).toEqual([])
        expect(historical).toEqual([
            expect.objectContaining({
                objectEntityName: 'Global Memory',
                predicate: 'stores_in',
                status: 'superseded',
                subjectEntityName: 'Konteks',
            }),
        ])
        await adapter.close()
    })
})

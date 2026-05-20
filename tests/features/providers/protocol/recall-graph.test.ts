// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/database/actions/_db'
import SQLiteMemoryRepository from '@/database/repositories/sqlite-memory-repository'
import recallRepositoryMemory from '@/memory/recall-repository-memory'
import { loadProjectContext } from '@/providers/project/context'
import { graphApi } from '../../../support/sqlite-action-api'

const tempDirs: string[] = []

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

async function makeGraph() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-recall-graph-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const adapter = await openProjectDatabase(context)
    return {
        adapter,
        context,
        graph: graphApi(adapter),
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
        const recall = await recallRepositoryMemory(repo, {
            task: 'memory system runtime',
        })
        const items = recall.graph

        expect(items.map(item => item.relatedEntityName)).toContain('Bun')
        expect(items.map(item => item.relatedEntityName)).not.toContain('Node')
        expect(items).toContainEqual(
            expect.objectContaining({
                depth: 1,
                entityName: 'Konteks',
                predicate: 'prefers_runtime',
                relatedEntityName: 'Bun',
            }),
        )
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
        const normalRecall = await recallRepositoryMemory(repo, {
            task: 'work on memory system',
        })
        const normal = normalRecall.history

        const historicalRecall = await recallRepositoryMemory(repo, {
            task: 'why did the previous memory system storage decision change',
        })
        const historical = historicalRecall.history

        expect(normal).toEqual([])
        expect(historical).toContainEqual(
            expect.objectContaining({
                objectEntityName: 'Global Memory',
                predicate: 'stores_in',
                status: 'superseded',
                subjectEntityName: 'Konteks',
            }),
        )
        await adapter.close()
    })
})

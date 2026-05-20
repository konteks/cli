import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import { querySql } from '@/providers/persistence/sqlite/libsql-helpers'
import { loadProjectContext } from '@/providers/project/context'
import { graphApi } from '../../../../../support/sqlite-action-api'

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
    entities: ReturnType<typeof graphApi>
    queryRelations: () => Promise<Array<{ id: string; status: string }>>
    relations: ReturnType<typeof graphApi>
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-relation-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const service = await openProjectDatabase(context)

    return {
        close: () => service.close(),
        entities: graphApi(service),
        queryRelations: () =>
            querySql<{ id: string; status: string }>(
                service.client,
                'select id, status from relations order by created_at',
            ),
        relations: graphApi(service),
    }
}

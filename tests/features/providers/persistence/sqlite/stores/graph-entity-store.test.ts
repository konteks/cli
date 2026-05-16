import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import GraphEntityStore from '@/providers/persistence/sqlite/stores/graph-entity-store'
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

describe('GraphEntityStore', () => {
    it('upserts canonical entities and searches aliases', async () => {
        const graph = await makeGraphEntityStore()
        try {
            const first = await graph.store.upsertEntity({
                aliases: ['Project Context Memory'],
                name: 'Konteks',
                summary: 'Local memory system for coding agents',
                type: 'project',
            })
            const second = await graph.store.upsertEntity({
                name: ' konteks ',
                summary: 'Updated summary',
                type: 'project',
            })

            const byName =
                await graph.store.findEntityByCanonicalName('KONTEKS')
            const byAlias = await graph.store.searchEntities('context memory')

            expect(second.id).toBe(first.id)
            expect(second.summary).toBe('Updated summary')
            expect(byName?.id).toBe(first.id)
            expect(byAlias[0]?.id).toBe(first.id)
        } finally {
            await graph.close()
        }
    })
})

async function makeGraphEntityStore(): Promise<{
    close: () => Promise<void>
    store: GraphEntityStore
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-entity-test-'))
    tempDirs.push(projectRoot)
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const service = await openProjectDatabase(context)

    return {
        close: () => service.close(),
        store: new GraphEntityStore(service.adapter),
    }
}

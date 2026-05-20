import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { querySql } from 'tests/support/sqlite-libsql'
import actionDb, { openProjectDatabase } from '@/database/actions/_db'
import forgetMemory from '@/database/services/forget-memory'
import { saveKonteksMemory } from '@/database/services/save-memory'
import searchMemory from '@/database/services/search-memory'
import { loadProjectContext } from '@/providers/project/context'
import { graphApi } from '../../../../../support/sqlite-action-api'

const tempDirs: string[] = []

async function makeAdapter() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-forget-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    return {
        adapter: await openProjectDatabase(context),
        context,
    }
}

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

describe('forgetMemory', () => {
    it('soft deletes saved memory and removes it from search', async () => {
        const { adapter, context } = await makeAdapter()
        const saved = await saveKonteksMemory(adapter, context, {
            content: 'Forget this obsolete implementation detail.',
            importance: 3,
            kind: 'note',
        })

        const result = await forgetMemory(adapter, {
            id: saved.id,
            mode: 'soft_delete',
            reason: 'obsolete',
        })
        await actionDb.syncTestActionDatabase(adapter.client)
        const search = await searchMemory(adapter, {
            limit: 5,
            query: 'obsolete implementation',
        })

        expect(result).toMatchObject({
            accepted: true,
            affectedIds: [saved.id],
            mode: 'soft_delete',
        })
        expect(search).toEqual([])
        await adapter.close()
    })

    it('hard deletes sensitive memory rows', async () => {
        const { adapter, context } = await makeAdapter()
        const saved = await saveKonteksMemory(adapter, context, {
            content: 'Remove this sensitive placeholder memory now.',
            importance: 3,
            kind: 'note',
        })

        await forgetMemory(adapter, {
            id: saved.id,
            mode: 'hard_delete',
            reason: 'sensitive',
        })
        const rows = await querySql<{ id: string }>(
            adapter.client,
            'select id from observations where id = ?',
            [saved.id],
        )

        expect(rows).toEqual([])
        await adapter.close()
    })

    it('query forget targets authored memory records', async () => {
        const { adapter, context } = await makeAdapter()
        const saved = await saveKonteksMemory(adapter, context, {
            content: 'Compatibility planning is out of scope for now.',
            importance: 3,
            kind: 'decision',
        })
        await actionDb.syncTestActionDatabase(adapter.client)

        const result = await forgetMemory(adapter, {
            mode: 'invalidate',
            query: 'compatibility planning',
            reason: 'not relevant now',
        })
        const rows = await querySql<{
            forget_reason: string | null
            suppressed_at: string | null
        }>(
            adapter.client,
            'select suppressed_at, forget_reason from observations where id = ?',
            [saved.id],
        )

        expect(result.affectedIds).toEqual([saved.id])
        expect(rows[0]?.suppressed_at).toEqual(expect.any(String))
        expect(rows[0]?.forget_reason).toBe('not relevant now')
        await adapter.close()
    })

    it('invalidates relations through the forget path', async () => {
        const { adapter } = await makeAdapter()
        const graph = graphApi(adapter)
        const project = await graph.upsertEntity({
            name: 'Konteks',
            type: 'project',
        })
        const runtime = await graph.upsertEntity({
            name: 'Bun',
            type: 'runtime',
        })
        const relation = await graph.addRelation({
            objectId: runtime.id,
            predicate: 'uses',
            subjectId: project.id,
        })

        await forgetMemory(adapter, {
            id: relation.id,
            mode: 'invalidate',
            reason: 'wrong relation',
        })

        expect(await graph.traverseNeighbors(project.id)).toEqual([])
        await adapter.close()
    })
})

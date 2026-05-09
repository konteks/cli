import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '../project/context.js'
import { openProjectDatabase } from '../storage/database.js'
import { forgetMemory } from './forget-store.js'
import { GraphStore } from './graph-store.js'
import { saveKonteksInput } from './save-store.js'
import { searchMemory } from './search-store.js'

const tempDirs: string[] = []

async function makeAdapter() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-forget-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    const context = await loadProjectContext(projectRoot)
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

describe('forgetMemory', () => {
    it('soft deletes saved memory and removes it from search', async () => {
        const { adapter, context } = await makeAdapter()
        const saved = await saveKonteksInput(adapter, context, {
            content: 'Forget this obsolete implementation detail.',
            kind: 'note',
            type: 'memory',
        })

        const result = await forgetMemory(adapter, {
            id: saved.id,
            mode: 'soft_delete',
            reason: 'obsolete',
        })
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
        const saved = await saveKonteksInput(adapter, context, {
            content: 'Remove this sensitive placeholder memory now.',
            kind: 'note',
            type: 'memory',
        })

        await forgetMemory(adapter, {
            id: saved.id,
            mode: 'hard_delete',
            reason: 'sensitive',
        })
        const rows = await adapter.adapter.query<{ id: string }>(
            'select id from observations where id = ?',
            [saved.id],
        )

        expect(rows).toEqual([])
        await adapter.close()
    })

    it('query forget targets authored memory records', async () => {
        const { adapter, context } = await makeAdapter()
        const saved = await saveKonteksInput(adapter, context, {
            content: 'Compatibility planning is out of scope for now.',
            kind: 'decision',
            type: 'memory',
        })

        const result = await forgetMemory(adapter, {
            mode: 'invalidate',
            query: 'compatibility planning',
            reason: 'not relevant now',
        })
        const rows = await adapter.adapter.query<{
            forget_reason: string | null
            suppressed_at: string | null
        }>(
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
        const graph = new GraphStore(adapter)
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

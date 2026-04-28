import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '../project/context.js'
import { openProjectDatabase } from '../storage/database.js'
import { saveKonteksInput } from './save-store.js'
import { searchMemory } from './search-store.js'

const tempDirs: string[] = []

async function makeTempContext() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-memory-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    return loadProjectContext(projectRoot)
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('save and search stores', () => {
    it('persists memory observations and returns lexical matches', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        const saved = await saveKonteksInput(adapter, context, {
            content: 'Use Bun test instead of Vitest for this project.',
            importance: 5,
            kind: 'preference',
            type: 'memory',
        })
        const results = await searchMemory(adapter, {
            limit: 5,
            query: 'vitest bun',
        })

        expect(saved.id).toStartWith('obs_')
        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
            id: saved.id,
            kind: 'preference',
            type: 'memory',
        })
        expect(results[0]?.excerpt).toContain('Bun test')
        await adapter.close()
    })

    it('persists session handoffs and searches task summaries', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        const saved = await saveKonteksInput(adapter, context, {
            decisions: ['Use official sqlite wasm package.'],
            nextSteps: ['Implement recall ranking.'],
            status: 'partial',
            summary: 'SQLite adapter is implemented and search remains next.',
            task: 'Build local memory storage',
            type: 'session',
        })
        const results = await searchMemory(adapter, {
            limit: 5,
            query: 'sqlite storage',
        })

        expect(saved.id).toStartWith('handoff_')
        expect(results[0]).toMatchObject({
            id: saved.id,
            status: 'partial',
            type: 'session',
        })
        await adapter.close()
    })
})

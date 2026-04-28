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

    it('uses FTS indexed documents for saved memories', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        const saved = await saveKonteksInput(adapter, context, {
            content: 'Konteks should retrieve context with full text search.',
            kind: 'decision',
            type: 'memory',
        })
        const results = await searchMemory(adapter, {
            limit: 5,
            query: 'retrieve context',
        })

        expect(results[0]?.id).toBe(saved.id)
        await adapter.close()
    })

    it('deduplicates durable memories by content hash', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)
        const content = 'Use content hashes to avoid duplicate durable memory.'

        const first = await saveKonteksInput(adapter, context, {
            content,
            kind: 'decision',
            type: 'memory',
        })
        const second = await saveKonteksInput(adapter, context, {
            content,
            kind: 'decision',
            type: 'memory',
        })

        expect(second).toMatchObject({
            duplicateOf: first.id,
            id: first.id,
        })
        await adapter.close()
    })

    it('rejects low-quality or sensitive memory content', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        await expect(
            saveKonteksInput(adapter, context, {
                content: 'too short',
                kind: 'note',
                type: 'memory',
            }),
        ).rejects.toThrow('too short')
        await expect(
            saveKonteksInput(adapter, context, {
                content: 'api_key = abcdefghijklmnopqrstuvwxyz',
                kind: 'note',
                type: 'memory',
            }),
        ).rejects.toThrow('secret')
        await adapter.close()
    })

    it('returns trimmed excerpts and scoring metadata for long memories', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)
        const longContent = Array.from(
            { length: 180 },
            (_, index) => `context-${index}`,
        ).join(' ')

        await saveKonteksInput(adapter, context, {
            content: `needle ${longContent}`,
            kind: 'note',
            type: 'memory',
        })
        const results = await searchMemory(adapter, {
            limit: 5,
            query: 'needle',
        })

        expect(results[0]?.excerpt.endsWith('...')).toBe(true)
        expect(results[0]?.tokenCost).toBeLessThanOrEqual(120)
        expect(results[0]?.scoreDetails).toMatchObject({
            confidence: 1,
            lexical: 1,
        })
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

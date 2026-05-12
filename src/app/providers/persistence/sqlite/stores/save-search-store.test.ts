import { afterEach, describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '@/app/providers/project/context'
import { mkdir, mkdtemp, rm, writeFile } from '@/app/support/file-manager'
import { openProjectDatabase } from '../database'
import { saveKonteksInput } from '../save-store'
import { searchMemory } from '../search-store'

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
            sourceRole: 'unknown',
            targetType: 'memory',
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

    it('persists diary entries and searches summaries', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        const saved = await saveKonteksInput(adapter, context, {
            subject: 'local memory storage',
            summary: 'SQLite adapter is implemented and search remains next.',
            tags: ['sqlite', 'storage'],
            type: 'diary',
        })
        const results = await searchMemory(adapter, {
            limit: 5,
            query: 'sqlite storage',
        })

        expect(saved.id).toStartWith('diary_')
        expect(results[0]).toMatchObject({
            id: saved.id,
            sourceRole: 'unknown',
            targetType: 'diary',
            type: 'diary',
        })
        await adapter.close()
    })

    it('persists structured memory batches and one diary entry', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        const savedMemories = await saveKonteksInput(adapter, context, {
            memories: [
                {
                    content:
                        'Save uses structured payloads instead of raw chat transcripts.',
                    kind: 'decision',
                    type: 'memory',
                },
                {
                    content:
                        'Konteks save must include one diary entry per coherent session.',
                    kind: 'constraint',
                    type: 'memory',
                },
            ],
            type: 'memories',
        })
        const savedDiary = await saveKonteksInput(adapter, context, {
            summary:
                'Implemented structured memory batch saves and a diary save phase.',
            tags: ['save'],
            type: 'diary',
        })
        const memoryResults = await searchMemory(adapter, {
            limit: 5,
            query: 'structured payloads raw chat',
        })
        const diaryResults = await searchMemory(adapter, {
            limit: 5,
            query: 'structured memory batch saves',
        })

        expect(savedMemories.memoryIds?.length).toBe(2)
        expect(savedDiary.id).toStartWith('diary_')
        expect(memoryResults.some(result => result.type === 'memory')).toBe(
            true,
        )
        expect(diaryResults.some(result => result.type === 'diary')).toBe(true)
        await adapter.close()
    })

    it('does not store structured memory when it contains a secret', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        await expect(
            saveKonteksInput(adapter, context, {
                content: 'api_key = abcdefghijklmnopqrstuvwxyz',
                kind: 'note',
                type: 'memory',
            }),
        ).rejects.toThrow('memory content appears to contain a secret')

        const rows = await adapter.adapter.query<{ count: number }>(
            'select count(*) as count from observations',
        )
        expect(rows[0]?.count).toBe(0)
        await adapter.close()
    })

    it('skips invalid structured memories in a batch', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        const saved = await saveKonteksInput(adapter, context, {
            memories: [
                {
                    content: 'too short',
                    kind: 'note',
                    type: 'memory',
                },
                {
                    content:
                        'Use structured save calls for durable memory persistence.',
                    kind: 'decision',
                    type: 'memory',
                },
            ],
            type: 'memories',
        })
        const results = await searchMemory(adapter, {
            limit: 5,
            query: 'structured save calls',
        })

        expect(saved.memoryIds?.length).toBe(1)
        expect(saved.skippedMemories).toBe(1)
        expect(results.some(result => result.type === 'memory')).toBe(true)
        await adapter.close()
    })

    it('indexes saved memory and diary into retrieval documents', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        const savedMemory = await saveKonteksInput(adapter, context, {
            content: 'Use retrieval_documents as primary retrieval substrate.',
            kind: 'decision',
            type: 'memory',
        })
        const savedDiary = await saveKonteksInput(adapter, context, {
            summary: 'Tried lexical ranking tweak for retrieval documents.',
            tags: ['retrieval'],
            type: 'diary',
        })

        const memoryResults = await searchMemory(adapter, {
            limit: 5,
            query: 'primary retrieval substrate',
        })
        const diaryResults = await searchMemory(adapter, {
            limit: 5,
            query: 'lexical ranking tweak retrieval',
        })

        expect(memoryResults.some(result => result.id === savedMemory.id)).toBe(
            true,
        )
        expect(diaryResults.some(result => result.id === savedDiary.id)).toBe(
            true,
        )
        await adapter.close()
    })
})

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import actionDb from '@/database/actions/_db'
import searchMemory from '@/database/services/search-memory'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import { querySql } from '@/providers/persistence/sqlite/libsql-helpers'
import {
    saveKonteksDiary,
    saveKonteksMemories,
    saveKonteksMemory,
} from '@/providers/persistence/sqlite/save-konteks-input'
import { loadProjectContext } from '@/providers/project/context'

const tempDirs: string[] = []

async function makeTempContext() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-memory-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    return await withProjectRoot(projectRoot, () => loadProjectContext())
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

describe('save and search stores', () => {
    it('persists memory observations and returns lexical matches', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        const saved = await saveKonteksMemory(adapter, context, {
            content: 'Use Bun test instead of Vitest for this project.',
            importance: 5,
            kind: 'preference',
        })
        await actionDb.syncTestActionDatabase(adapter.client)
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

        const saved = await saveKonteksMemory(adapter, context, {
            content: 'Konteks should retrieve context with full text search.',
            importance: 3,
            kind: 'decision',
        })
        await actionDb.syncTestActionDatabase(adapter.client)
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

        const first = await saveKonteksMemory(adapter, context, {
            content,
            importance: 3,
            kind: 'decision',
        })
        const second = await saveKonteksMemory(adapter, context, {
            content,
            importance: 3,
            kind: 'decision',
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
            saveKonteksMemory(adapter, context, {
                content: 'too short',
                importance: 1,
                kind: 'note',
            }),
        ).rejects.toThrow('too short')
        await expect(
            saveKonteksMemory(adapter, context, {
                content: 'api_key = abcdefghijklmnopqrstuvwxyz',
                importance: 1,
                kind: 'note',
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

        await saveKonteksMemory(adapter, context, {
            content: `needle ${longContent}`,
            importance: 3,
            kind: 'note',
        })
        await actionDb.syncTestActionDatabase(adapter.client)
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

        const saved = await saveKonteksDiary(adapter, context, {
            subject: 'local memory storage',
            summary: 'SQLite adapter is implemented and search remains next.',
            tags: ['sqlite', 'storage'],
        })
        await actionDb.syncTestActionDatabase(adapter.client)
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

        const savedMemories = await saveKonteksMemories(adapter, context, {
            memories: [
                {
                    content:
                        'Save uses structured payloads instead of raw chat transcripts.',
                    importance: 3,
                    kind: 'decision',
                },
                {
                    content:
                        'Konteks save must include one diary entry per coherent session.',
                    importance: 4,
                    kind: 'constraint',
                },
            ],
        })
        const savedDiary = await saveKonteksDiary(adapter, context, {
            summary:
                'Implemented structured memory batch saves and a diary save phase.',
            tags: ['save'],
        })
        await actionDb.syncTestActionDatabase(adapter.client)
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
            saveKonteksMemory(adapter, context, {
                content: 'api_key = abcdefghijklmnopqrstuvwxyz',
                importance: 1,
                kind: 'note',
            }),
        ).rejects.toThrow('memory content appears to contain a secret')

        const rows = await querySql<{ count: number }>(
            adapter.client,
            'select count(*) as count from observations',
        )
        expect(rows[0]?.count).toBe(0)
        await adapter.close()
    })

    it('skips invalid structured memories in a batch', async () => {
        const context = await makeTempContext()
        const adapter = await openProjectDatabase(context)

        const saved = await saveKonteksMemories(adapter, context, {
            memories: [
                {
                    content: 'too short',
                    importance: 1,
                    kind: 'note',
                },
                {
                    content:
                        'Use structured save calls for durable memory persistence.',
                    importance: 3,
                    kind: 'decision',
                },
            ],
        })
        await actionDb.syncTestActionDatabase(adapter.client)
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

        const savedMemory = await saveKonteksMemory(adapter, context, {
            content: 'Use retrieval_documents as primary retrieval substrate.',
            importance: 3,
            kind: 'decision',
        })
        const savedDiary = await saveKonteksDiary(adapter, context, {
            summary: 'Tried lexical ranking tweak for retrieval documents.',
            tags: ['retrieval'],
        })

        await actionDb.syncTestActionDatabase(adapter.client)
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

// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/database/actions/_db'
import { contentHash } from '@/providers/persistence/objects/content'
import {
    insertImportedDiary,
    insertImportedObservation,
} from '@/providers/persistence/sqlite/durable-memory-import-writers'
import { querySql } from '@/providers/persistence/sqlite/libsql-helpers'
import { loadProjectContext } from '@/providers/project/context'

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

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('durable memory import writers', () => {
    it('inserts observations and diaries with search and retrieval rows', async () => {
        const { context, db } = await makeProject()
        try {
            await insertImportedObservation(db, context, {
                confidence: 0.9,
                content: 'Imported observation content.',
                contentHash: contentHash('Imported observation content.'),
                createdAt: '2026-01-01T00:00:00.000Z',
                id: 'obs_exported',
                kind: 'fact',
            })
            await insertImportedDiary(db, context, {
                contentHash: contentHash('import diary\nImported diary.'),
                createdAt: '2026-01-01T00:00:00.000Z',
                id: 'diary_exported',
                subject: 'import diary',
                summary: 'Imported diary.',
                tags: ['import'],
            })

            const observations = await querySql<{ count: number }>(
                db.client,
                'select count(*) as count from observations',
            )
            const diaries = await querySql<{ count: number }>(
                db.client,
                'select count(*) as count from diary_entries',
            )
            const retrievalRows = await querySql<{ count: number }>(
                db.client,
                'select count(*) as count from retrieval_documents',
            )
            const indexedRows = await querySql<{ count: number }>(
                db.client,
                'select count(*) as count from memory_fts_indexed',
            )

            expect(observations[0]?.count).toBe(1)
            expect(diaries[0]?.count).toBe(1)
            expect(retrievalRows[0]?.count).toBe(2)
            expect(indexedRows[0]?.count).toBe(2)
        } finally {
            await db.close()
        }
    })
})

async function makeProject() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-writer-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const db = await openProjectDatabase(context)
    return { context, db }
}

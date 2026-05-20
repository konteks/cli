import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { executeSql } from 'tests/support/sqlite-libsql'
import actionDb, { openProjectDatabase } from '@/database/actions/_db'
import {
    ensureSearchIndex,
    hasSearchIndex,
} from '@/database/actions/search-index'
import searchMemory from '@/database/services/search-memory'
import { loadProjectContext } from '@/providers/project/context'

const tempDirs: string[] = []

async function makeAdapter() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-fts-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    return await withProjectRoot(projectRoot, async () =>
        openProjectDatabase(await loadProjectContext()),
    )
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

describe('search index', () => {
    it('creates an FTS index when supported by SQLite', async () => {
        const service = await makeAdapter()

        expect(await hasSearchIndex(service)).toBe(true)

        await service.close()
    })

    it('backfills existing observations into FTS', async () => {
        const service = await makeAdapter()
        await executeSql(service.client, 'drop table memory_fts')
        await executeSql(service.client, 'drop table memory_fts_indexed')
        await executeSql(
            service.client,
            `
insert into observations (id, kind, text_inline, payload_ref, confidence, created_at)
values (?, ?, ?, ?, ?, ?)
`,
            [
                'obs_existing',
                'decision',
                'Use FTS for lexical memory search.',
                null,
                1,
                new Date().toISOString(),
            ],
        )

        expect(await ensureSearchIndex(service)).toBe(true)
        await actionDb.syncTestActionDatabase(service.client)
        const results = await searchMemory(service, {
            limit: 5,
            query: 'lexical search',
        })

        expect(results[0]).toMatchObject({
            id: 'obs_existing',
            type: 'memory',
        })
        await service.close()
    })
})

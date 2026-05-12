import { afterEach, describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProjectContext } from '@/app/providers/project/context'
import { mkdtemp, rm } from '@/app/support/file-manager'
import { openProjectDatabase } from '../database'
import { ensureSearchIndex, hasSearchIndex } from '../search-index'
import { searchMemory } from '../search-store'

const tempDirs: string[] = []

async function makeAdapter() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-fts-test-'))
    tempDirs.push(projectRoot)
    return openProjectDatabase(await loadProjectContext(projectRoot))
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('search index', () => {
    it('creates an FTS index when supported by SQLite WASM', async () => {
        const service = await makeAdapter()

        expect(await hasSearchIndex(service.adapter)).toBe(true)

        await service.close()
    })

    it('backfills existing observations into FTS', async () => {
        const service = await makeAdapter()
        const adapter = service.adapter
        await adapter.execute('drop table memory_fts')
        await adapter.execute('drop table memory_fts_indexed')
        await adapter.execute(
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

        expect(await ensureSearchIndex(adapter)).toBe(true)
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

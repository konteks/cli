// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    unlink,
    writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { EmbeddingProviderContract as EmbeddingProvider } from '@/contracts/services/embedding-provider'
import actionDb from '@/database/actions/_db'
import searchMemory from '@/database/services/search-memory'
import {
    getExtractionFreshness,
    readExtractionManifest,
} from '@/providers/extraction/engine/manifest'
import { extractProject } from '@/providers/extraction/extract-project'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import {
    executeSql,
    querySql,
} from '@/providers/persistence/sqlite/libsql-helpers'
import {
    saveKonteksDiary,
    saveKonteksMemory,
} from '@/providers/persistence/sqlite/save-konteks-input'
import { loadProjectContext } from '@/providers/project/context'
import FakeEmbeddingProvider from '../../../../fake/fake-embedding-provider'

const tempDirs: string[] = []

async function extractTestProject(
    context: Awaited<ReturnType<typeof loadProjectContext>>,
    mode: Parameters<typeof extractProject>[1],
    options: Parameters<typeof extractProject>[2] = {},
) {
    return await extractProject(context, mode, options)
}

const throwingEmbeddingProvider: EmbeddingProvider = {
    dimensions: 8,
    async embed(): Promise<Float32Array[]> {
        throw new Error('forced embedding failure')
    },
    model: 'fake/all-MiniLM-L6-v2',
}

const mismatchedEmbeddingProvider: EmbeddingProvider = {
    dimensions: 8,
    embed(texts: string[]): Promise<Float32Array[]> {
        return new FakeEmbeddingProvider(8).embed(texts)
    },
    model: 'fake/other-model',
}

async function makeTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-extract-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    await writeFile(join(projectRoot, 'README.md'), '# Fixture\n')
    await writeFile(
        join(projectRoot, 'src', 'index.txt'),
        'Konteks fixture notes for extraction tests.\n',
    )
    await writeFile(join(projectRoot, '.env.local'), 'SECRET=hidden\n')

    return projectRoot
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('extractProject', () => {
    it('writes a manifest and TOON project summary', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        const result = await extractTestProject(context, 'reindex')
        const manifest = await readExtractionManifest(context.memoryDir)
        const summary = await createToonStore(context.memoryDir).read(
            result.summaryRef,
        )

        expect(result.ok).toBe(true)
        expect(result.fileCount).toBe(2)
        expect(result.chunkCount).toBeGreaterThan(1)
        expect(result.technologies).toEqual([])
        expect(manifest?.summaryRef).toBe(result.summaryRef)
        expect(manifest?.diagnostics).toMatchObject({
            chunkCount: result.chunkCount,
            detectedParserLanguages: [],
            filesIncluded: 2,
            filesSkipped: {
                secret: 1,
            },
            filesTruncatedByChunkLimit: 0,
        })
        expect(manifest?.files.map(file => file.path)).toEqual([
            'README.md',
            'src/index.txt',
        ])
        expect(summary).toContain('README.md')
        expect(summary).not.toContain('.env.local')
    })

    it('stores extracted chunks, search index entries, taxonomy links, and chronology events', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'reindex')

        const service = await openProjectDatabase(context)
        const chunks = await querySql<{
            anchor: string | null
            id: string
            language: string | null
            path: string
            source_role: string | null
        }>(
            service.client,
            'select id, path, source_role, language, anchor from chunks order by path',
        )
        const retrievalDocuments = await querySql<{
            source_role: string | null
            target_type: string
        }>(
            service.client,
            `
select target_type, source_role
from retrieval_documents
order by target_type, source_role
`,
        )
        const modules = await querySql<{ path: string }>(
            service.client,
            'select path from modules order by path',
        )
        await actionDb.syncTestActionDatabase(service.client)
        const searchResults = await searchMemory(service, {
            limit: 5,
            query: 'Fixture',
        })
        const taxonomy = service.taxonomy
        const roots = await taxonomy.getSubtree(undefined, { maxDepth: 2 })
        const events = await querySql<{ event_type: string }>(
            service.client,
            'select event_type from memory_events where event_type = ?',
            ['project_mined'],
        )
        await service.close()

        expect(chunks.some(chunk => chunk.path === 'README.md')).toBe(true)
        expect(chunks.some(chunk => chunk.source_role === 'product_doc')).toBe(
            true,
        )
        expect(chunks.some(chunk => chunk.anchor)).toBe(true)
        expect(
            retrievalDocuments.some(
                document => document.target_type === 'chunk',
            ),
        ).toBe(true)
        expect(
            retrievalDocuments.some(
                document => document.target_type === 'module',
            ),
        ).toBe(true)
        expect(modules.map(module => module.path)).toContain('src')
        expect(searchResults[0]?.type).toBe('chunk')
        expect(searchResults[0]?.sourceId).toStartWith('source_')
        expect(searchResults[0]?.tokenCost).toBeGreaterThan(0)
        expect(searchResults[0]?.scoreDetails?.lexical).toBeGreaterThan(0)
        expect(roots.map(node => node.name)).toContain('Project Files')
        expect(roots.map(node => node.name)).toContain('src')
        expect(events).toEqual([{ event_type: 'project_mined' }])
    })

    it('searches retrieval documents with vector reranking and safe FTS fallback', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        const embeddingProvider = new FakeEmbeddingProvider()

        await extractTestProject(context, 'reindex', { embeddingProvider })

        const service = await openProjectDatabase(context)
        await actionDb.syncTestActionDatabase(service.client)
        const vectorResults = await searchMemory(
            service,
            {
                limit: 5,
                query: 'Fixture',
            },
            { embeddingProvider },
        )
        const fallbackResults = await searchMemory(
            service,
            {
                limit: 5,
                query: 'Fixture',
            },
            { embeddingProvider: throwingEmbeddingProvider },
        )
        const mismatchedResults = await searchMemory(
            service,
            {
                limit: 5,
                query: 'Fixture',
            },
            { embeddingProvider: mismatchedEmbeddingProvider },
        )
        await service.close()

        expect(vectorResults[0]?.type).toBe('chunk')
        expect(vectorResults[0]?.sourceRole).toBeTruthy()
        expect(vectorResults[0]?.path).toBeTruthy()
        expect(vectorResults[0]?.anchor).toBeTruthy()
        expect(vectorResults[0]?.embeddingModel).toBe(embeddingProvider.model)
        expect(vectorResults[0]?.embeddingDimensions).toBe(
            embeddingProvider.dimensions,
        )
        expect(vectorResults[0]?.vectorScore).toBeNumber()
        expect(vectorResults[0]?.scoreDetails?.vector).toBeNumber()
        expect(fallbackResults.length).toBeGreaterThan(0)
        expect(fallbackResults[0]?.vectorScore).toBeUndefined()
        expect(mismatchedResults.length).toBeGreaterThan(0)
        expect(mismatchedResults[0]?.vectorScore).toBeUndefined()
    })

    it('preserves suppressed extracted chunks across reindex', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'reindex')

        const service = await openProjectDatabase(context)
        const chunks = await querySql<{
            anchor: string
            content_hash: string
            path: string
        }>(
            service.client,
            `
select path, anchor, content_hash
from chunks
where path = ?
limit 1
`,
            ['README.md'],
        )
        const chunk = chunks[0]
        expect(chunk).toBeDefined()
        await executeSql(
            service.client,
            `
update chunks
set suppressed_at = ?, forget_reason = ?
where path = ? and anchor = ? and content_hash = ?
`,
            [
                new Date().toISOString(),
                'test suppression',
                chunk?.path ?? '',
                chunk?.anchor ?? '',
                chunk?.content_hash ?? '',
            ],
        )
        await service.close()

        await extractTestProject(context, 'reindex')

        const reindexedService = await openProjectDatabase(context)
        const restored = await querySql<{
            count: number
        }>(
            reindexedService.client,
            `
select count(*) as count
from chunks
where path = ? and anchor = ? and content_hash = ?
`,
            [chunk?.path ?? '', chunk?.anchor ?? '', chunk?.content_hash ?? ''],
        )
        const suppressions = await querySql<{
            count: number
        }>(
            reindexedService.client,
            `
select count(*) as count
from mined_suppressions
where path = ? and anchor = ? and content_hash = ?
`,
            [chunk?.path ?? '', chunk?.anchor ?? '', chunk?.content_hash ?? ''],
        )
        await reindexedService.close()

        expect(restored[0]?.count).toBe(0)
        expect(suppressions[0]?.count).toBe(1)
    })

    it('preserves durable memories, diaries, and retrieval indexes across reindex', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'reindex')

        const service = await openProjectDatabase(context)
        const savedMemory = await saveKonteksMemory(service, context, {
            content:
                'Repair must preserve durable observations during reindex operations.',
            importance: 3,
            kind: 'constraint',
        })
        const savedDiary = await saveKonteksDiary(service, context, {
            subject: 'repair durability',
            summary:
                'Verified repair keeps durable diary entries and retrieval indexes available.',
            tags: ['repair'],
        })
        await service.close()

        await extractTestProject(context, 'reindex')

        const repairedService = await openProjectDatabase(context)
        const durableRows = await querySql<{
            count: number
        }>(
            repairedService.client,
            `
select count(*) as count
from (
    select id from observations where id = ?
    union all
    select id from diary_entries where id = ?
)
`,
            [savedMemory.id, savedDiary.id],
        )
        const retrievalRows = await querySql<{
            count: number
        }>(
            repairedService.client,
            `
select count(*) as count
from retrieval_documents
where (target_type = 'memory' and target_id = ?)
   or (target_type = 'diary' and target_id = ?)
`,
            [savedMemory.id, savedDiary.id],
        )
        const retrievalFtsRows = await querySql<{
            count: number
        }>(
            repairedService.client,
            `
select count(*) as count
from retrieval_documents_fts
where (target_type = 'memory' and target_id = ?)
   or (target_type = 'diary' and target_id = ?)
`,
            [savedMemory.id, savedDiary.id],
        )
        const memoryFtsRows = await querySql<{
            count: number
        }>(
            repairedService.client,
            `
select count(*) as count
from memory_fts
where id in (?, ?)
`,
            [savedMemory.id, savedDiary.id],
        )
        await actionDb.syncTestActionDatabase(repairedService.client)
        const results = await searchMemory(repairedService, {
            limit: 5,
            query: 'repair preserve durable',
        })
        await repairedService.close()

        expect(durableRows[0]?.count).toBe(2)
        expect(retrievalRows[0]?.count).toBe(2)
        expect(retrievalFtsRows[0]?.count).toBe(2)
        expect(memoryFtsRows[0]?.count).toBe(2)
        expect(results.some(result => result.id === savedMemory.id)).toBe(true)
    })

    it('reports fresh status after extraction and stale after a file change', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await extractTestProject(context, 'reindex')

        const fresh = await getExtractionFreshness(context)
        expect(fresh.status).toBe('fresh')

        await writeFile(
            join(projectRoot, 'src', 'new.txt'),
            'export const x = 1\n',
        )

        const stale = await getExtractionFreshness(context)
        expect(stale.status).toBe('stale')
        expect(stale.recommendedCommand).toBe('konteks repair')
    })

    it('caps chunks per file and reports the diagnostic', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(
            join(projectRoot, 'src', 'many.md'),
            Array.from({ length: 205 }, (_, index) => [
                `## Section ${index}`,
                `value ${index}`,
            ])
                .flat()
                .join('\n'),
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'reindex')

        const service = await openProjectDatabase(context)
        const chunks = await querySql<{ count: number }>(
            service.client,
            'select count(*) as count from chunks where path = ?',
            ['src/many.md'],
        )
        await service.close()
        const manifest = await readExtractionManifest(context.memoryDir)

        expect(chunks[0]?.count).toBe(200)
        expect(manifest?.diagnostics?.filesTruncatedByChunkLimit).toBe(1)
    })

    it('stores the manifest as local JSON', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'changed')

        const rawManifest = await readFile(
            join(projectRoot, '.konteks', 'mine-manifest.json'),
            'utf8',
        )
        expect(JSON.parse(rawManifest).mode).toBe('changed')
    })

    it('extracts package.json with bundled config grammars', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(
            join(projectRoot, 'package.json'),
            '{"name":"fixture","type":"module"}\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await expect(extractProject(context, 'reindex')).resolves.toMatchObject(
            {
                ok: true,
            },
        )

        const service = await openProjectDatabase(context)
        const chunks = await querySql<{ count: number }>(
            service.client,
            'select count(*) as count from chunks where path = ?',
            ['package.json'],
        )
        await service.close()

        expect(chunks[0]?.count).toBeGreaterThan(0)
    })

    it('skips unselected source grammar files', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(
            join(projectRoot, 'src', 'unselected.ts'),
            'export const unselected = true\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await expect(extractProject(context, 'reindex')).resolves.toMatchObject(
            {
                ok: true,
            },
        )

        const service = await openProjectDatabase(context)
        const chunks = await querySql<{ count: number }>(
            service.client,
            'select count(*) as count from chunks where path = ?',
            ['src/unselected.ts'],
        )
        await service.close()

        expect(chunks[0]?.count).toBe(0)
    })

    it('stores reindex mode in manifest', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'reindex')
        await extractTestProject(context, 'reindex')

        const rawManifest = await readFile(
            join(projectRoot, '.konteks', 'mine-manifest.json'),
            'utf8',
        )
        const manifest = JSON.parse(rawManifest)
        const service = await openProjectDatabase(context)
        const chunks = await querySql<{ count: number }>(
            service.client,
            'select count(*) as count from chunks',
        )
        await service.close()

        expect(manifest.mode).toBe('reindex')
        expect(chunks[0]?.count).toBeGreaterThan(0)
    })

    it('changed mode removes deleted-file chunks and preserves unchanged chunks', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'reindex')

        await unlink(join(projectRoot, 'README.md'))
        await writeFile(
            join(projectRoot, 'src', 'new.txt'),
            'export const n = 1\n',
        )
        await extractTestProject(context, 'changed')

        const service = await openProjectDatabase(context)
        const readmeChunks = await querySql<{ count: number }>(
            service.client,
            'select count(*) as count from chunks where path = ?',
            ['README.md'],
        )
        const indexChunks = await querySql<{ count: number }>(
            service.client,
            'select count(*) as count from chunks where path = ?',
            ['src/index.txt'],
        )
        const newChunks = await querySql<{ count: number }>(
            service.client,
            'select count(*) as count from chunks where path = ?',
            ['src/new.txt'],
        )
        await service.close()

        expect(readmeChunks[0]?.count).toBe(0)
        expect(indexChunks[0]?.count).toBeGreaterThan(0)
        expect(newChunks[0]?.count).toBeGreaterThan(0)
    })

    it('extracts repeated anchors with identical content without chunk ID collisions', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(
            join(projectRoot, 'README.md'),
            ['# Repeat', 'same content', '# Repeat', 'same content'].join('\n'),
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await extractTestProject(context, 'reindex')

        const service = await openProjectDatabase(context)
        const readmeChunks = await querySql<{ count: number }>(
            service.client,
            'select count(*) as count from chunks where path = ?',
            ['README.md'],
        )
        await service.close()

        expect(readmeChunks[0]?.count).toBe(2)
    })

    it('fails when a required Tree-sitter parser fails', async () => {
        const projectRoot = await makeTempProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await expect(extractProject(context, 'reindex')).resolves.toMatchObject(
            {
                ok: true,
            },
        )
    })
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

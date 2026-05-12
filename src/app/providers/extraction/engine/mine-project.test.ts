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
import type { EmbeddingProviderContract as EmbeddingProvider } from '@/app/contracts/services/embedding-provider'
import { mineProject } from '@/app/providers/extraction/mine-project'
import { createToonStore } from '@/app/providers/persistence/objects/toon-store'
import { openProjectDatabase } from '@/app/providers/persistence/sqlite/database'
import { searchMemory } from '@/app/providers/persistence/sqlite/search-store'
// import { TaxonomyStore } from '../persistence/sqli./taxonomy-store'
import { loadProjectContext } from '@/app/providers/project/context'
import { readProjectStatus } from '@/composition/project-status'
import { FakeEmbeddingProvider } from '@/support/fake/fake-embedding-provider'
import { getMiningFreshness, readMineManifest } from './manifest'
import type { TreeSitterLanguage } from './tree-sitter-engine'

const tempDirs: string[] = []

class FailingTreeSitterEngine {
    async init() {}

    async loadLanguage(_: TreeSitterLanguage, __: string) {}

    async parse(): Promise<never> {
        throw new Error('forced parser failure')
    }
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
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-mine-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    await writeFile(
        join(projectRoot, 'package.json'),
        JSON.stringify(
            {
                dependencies: {
                    '@modelcontextprotocol/sdk': '^1.0.0',
                    commander: '^1.0.0',
                },
                devDependencies: {
                    '@types/bun': '^1.0.0',
                    typescript: '^5.0.0',
                },
                name: 'fixture',
                scripts: {
                    test: 'bun test',
                },
            },
            null,
            2,
        ),
    )
    await writeFile(join(projectRoot, 'README.md'), '# Fixture\n')
    await writeFile(join(projectRoot, 'src', 'index.ts'), 'export {}\n')
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

describe('mineProject', () => {
    it('writes a manifest and TOON project summary', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)

        const result = await mineProject(context, 'reindex')
        const manifest = await readMineManifest(context.memoryDir)
        const summary = await createToonStore(context.memoryDir).read(
            result.summaryRef,
        )

        expect(result.ok).toBe(true)
        expect(result.fileCount).toBe(3)
        expect(result.chunkCount).toBeGreaterThan(3)
        expect(result.technologies).toEqual([
            'bun',
            'cli',
            'javascript',
            'mcp',
            'typescript',
        ])
        expect(manifest?.summaryRef).toBe(result.summaryRef)
        expect(manifest?.diagnostics).toMatchObject({
            chunkCount: result.chunkCount,
            filesIncluded: 3,
            filesSkipped: {
                secret: 1,
            },
            filesTruncatedByChunkLimit: 0,
        })
        expect(manifest?.files.map(file => file.path)).toEqual([
            'README.md',
            'package.json',
            'src/index.ts',
        ])
        expect(summary).toContain('name: fixture')
        expect(summary).not.toContain('.env.local')
    })

    it('stores mined chunks, search index entries, taxonomy links, and chronology events', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)

        await mineProject(context, 'reindex')

        const service = await openProjectDatabase(context)
        const adapter = service.adapter
        const chunks = await adapter.query<{
            anchor: string | null
            id: string
            language: string | null
            path: string
            source_role: string | null
        }>(
            'select id, path, source_role, language, anchor from chunks order by path',
        )
        const retrievalDocuments = await adapter.query<{
            source_role: string | null
            target_type: string
        }>(
            `
select target_type, source_role
from retrieval_documents
order by target_type, source_role
`,
        )
        const modules = await adapter.query<{ path: string }>(
            'select path from modules order by path',
        )
        const packageModule = await adapter.query<{
            imports_json: string
            package_name: string | null
        }>(
            'select package_name, imports_json from modules where source_role = ? and package_name is not null',
            ['package_config'],
        )
        const searchResults = await searchMemory(service, {
            limit: 5,
            query: 'Fixture',
        })
        const taxonomy = service.taxonomy
        const roots = await taxonomy.getSubtree(undefined, { maxDepth: 2 })
        const events = await adapter.query<{ event_type: string }>(
            'select event_type from memory_events where event_type = ?',
            ['project_mined'],
        )
        await service.close()

        expect(chunks.some(chunk => chunk.path === 'README.md')).toBe(true)
        expect(chunks.some(chunk => chunk.source_role === 'product_doc')).toBe(
            true,
        )
        expect(chunks.some(chunk => chunk.language === 'typescript')).toBe(true)
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
        expect(packageModule[0]?.package_name).toBe('fixture')
        expect(packageModule[0]?.imports_json).toContain('commander')
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
        const context = await loadProjectContext(projectRoot)
        const embeddingProvider = new FakeEmbeddingProvider()

        await mineProject(context, 'reindex', { embeddingProvider })

        const service = await openProjectDatabase(context)
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

    it('preserves suppressed mined chunks across reindex', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)

        await mineProject(context, 'reindex')

        const service = await openProjectDatabase(context)
        const chunks = await service.adapter.query<{
            anchor: string
            content_hash: string
            path: string
        }>(
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
        await service.adapter.execute(
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

        await mineProject(context, 'reindex')

        const reindexedService = await openProjectDatabase(context)
        const restored = await reindexedService.adapter.query<{
            count: number
        }>(
            `
select count(*) as count
from chunks
where path = ? and anchor = ? and content_hash = ?
`,
            [chunk?.path ?? '', chunk?.anchor ?? '', chunk?.content_hash ?? ''],
        )
        const suppressions = await reindexedService.adapter.query<{
            count: number
        }>(
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

    it('reports fresh status after mining and stale after a file change', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'reindex')

        const fresh = await getMiningFreshness(context)
        expect(fresh.status).toBe('fresh')

        await writeFile(
            join(projectRoot, 'src', 'new.ts'),
            'export const x = 1\n',
        )

        const stale = await readProjectStatus(projectRoot)
        expect(stale.freshness.status).toBe('stale')
        expect(stale.freshness.recommendedCommand).toBe('konteks repair')
    })

    it('caps chunks per file and reports the diagnostic', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(
            join(projectRoot, 'src', 'many.ts'),
            Array.from(
                { length: 205 },
                (_, index) => `export const value${index} = ${index}`,
            ).join('\n'),
        )
        const context = await loadProjectContext(projectRoot)

        await mineProject(context, 'reindex')

        const service = await openProjectDatabase(context)
        const chunks = await service.adapter.query<{ count: number }>(
            'select count(*) as count from chunks where path = ?',
            ['src/many.ts'],
        )
        await service.close()
        const manifest = await readMineManifest(context.memoryDir)

        expect(chunks[0]?.count).toBe(200)
        expect(manifest?.diagnostics?.filesTruncatedByChunkLimit).toBe(1)
    })

    it('stores the manifest as local JSON', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)

        await mineProject(context, 'changed')

        const rawManifest = await readFile(
            join(projectRoot, '.konteks', 'mine-manifest.json'),
            'utf8',
        )
        expect(JSON.parse(rawManifest).mode).toBe('changed')
    })

    it('stores reindex mode in manifest', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)

        await mineProject(context, 'reindex')
        await mineProject(context, 'reindex')

        const rawManifest = await readFile(
            join(projectRoot, '.konteks', 'mine-manifest.json'),
            'utf8',
        )
        const manifest = JSON.parse(rawManifest)
        const service = await openProjectDatabase(context)
        const chunks = await service.adapter.query<{ count: number }>(
            'select count(*) as count from chunks',
        )
        await service.close()

        expect(manifest.mode).toBe('reindex')
        expect(chunks[0]?.count).toBeGreaterThan(0)
    })

    it('changed mode removes deleted-file chunks and preserves unchanged chunks', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)

        await mineProject(context, 'reindex')

        await unlink(join(projectRoot, 'README.md'))
        await writeFile(
            join(projectRoot, 'src', 'new.ts'),
            'export const n = 1\n',
        )
        await mineProject(context, 'changed')

        const service = await openProjectDatabase(context)
        const readmeChunks = await service.adapter.query<{ count: number }>(
            'select count(*) as count from chunks where path = ?',
            ['README.md'],
        )
        const indexChunks = await service.adapter.query<{ count: number }>(
            'select count(*) as count from chunks where path = ?',
            ['src/index.ts'],
        )
        const newChunks = await service.adapter.query<{ count: number }>(
            'select count(*) as count from chunks where path = ?',
            ['src/new.ts'],
        )
        await service.close()

        expect(readmeChunks[0]?.count).toBe(0)
        expect(indexChunks[0]?.count).toBeGreaterThan(0)
        expect(newChunks[0]?.count).toBeGreaterThan(0)
    })

    it('mines repeated anchors with identical content without chunk ID collisions', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(
            join(projectRoot, 'README.md'),
            ['# Repeat', 'same content', '# Repeat', 'same content'].join('\n'),
        )
        const context = await loadProjectContext(projectRoot)

        await mineProject(context, 'reindex')

        const service = await openProjectDatabase(context)
        const readmeChunks = await service.adapter.query<{ count: number }>(
            'select count(*) as count from chunks where path = ?',
            ['README.md'],
        )
        await service.close()

        expect(readmeChunks[0]?.count).toBe(2)
    })

    it('falls back deterministically when parser fails', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)

        const result = await mineProject(context, 'reindex', {
            treeSitterEngine: new FailingTreeSitterEngine() as never,
        })
        const manifest = await readMineManifest(context.memoryDir)

        expect(result.ok).toBe(true)
        expect(result.chunkCount).toBeGreaterThan(0)
        expect(manifest?.diagnostics?.parserFallbackFiles).toBeGreaterThan(0)
        expect(manifest?.diagnostics?.parserUsedFiles).toBe(0)
    })
})

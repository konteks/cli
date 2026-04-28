import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { searchMemory } from '../memory/search-store.js'
import { TaxonomyStore } from '../memory/taxonomy-store.js'
import { loadProjectContext } from '../project/context.js'
import { getProjectStatus } from '../project/status.js'
import { openProjectDatabase } from '../storage/database.js'
import { createToonStore } from '../storage/toon-store.js'
import { getMiningFreshness, readMineManifest } from './manifest.js'
import { mineProject } from './mine-project.js'

const tempDirs: string[] = []

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

        const result = await mineProject(context, 'full')
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

        await mineProject(context, 'full')

        const adapter = await openProjectDatabase(context)
        const chunks = await adapter.query<{ id: string; path: string }>(
            'select id, path from chunks order by path',
        )
        const searchResults = await searchMemory(adapter, {
            limit: 5,
            query: 'Fixture',
        })
        const taxonomy = new TaxonomyStore(adapter)
        const roots = await taxonomy.getSubtree(undefined, { maxDepth: 2 })
        const events = await adapter.query<{ event_type: string }>(
            'select event_type from memory_events where event_type = ?',
            ['project_mined'],
        )
        await adapter.close()

        expect(chunks.some(chunk => chunk.path === 'README.md')).toBe(true)
        expect(searchResults[0]?.type).toBe('chunk')
        expect(searchResults[0]?.sourceId).toStartWith('source_')
        expect(searchResults[0]?.tokenCost).toBeGreaterThan(0)
        expect(searchResults[0]?.scoreDetails.lexical).toBeGreaterThan(0)
        expect(roots.map(node => node.name)).toContain('Project Files')
        expect(roots.map(node => node.name)).toContain('src')
        expect(events).toEqual([{ event_type: 'project_mined' }])
    })

    it('reports fresh status after mining and stale after a file change', async () => {
        const projectRoot = await makeTempProject()
        const context = await loadProjectContext(projectRoot)
        await mineProject(context, 'full')

        const fresh = await getMiningFreshness(context)
        expect(fresh.status).toBe('fresh')

        await writeFile(
            join(projectRoot, 'src', 'new.ts'),
            'export const x = 1\n',
        )

        const stale = await getProjectStatus(projectRoot)
        expect(stale.freshness.status).toBe('stale')
        expect(stale.freshness.recommendedCommand).toBe(
            'konteks mine --changed',
        )
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
})

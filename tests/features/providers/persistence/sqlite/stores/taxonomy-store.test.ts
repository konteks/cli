import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import TaxonomyStore from '@/providers/persistence/sqlite/stores/taxonomy-store'
import { loadProjectContext } from '@/providers/project/context'

const tempDirs: string[] = []

async function makeTaxonomyStore(): Promise<{
    close: () => Promise<void>
    store: TaxonomyStore
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-tax-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const service = await openProjectDatabase(context)

    return {
        close: () => service.close(),
        store: new TaxonomyStore(service.adapter),
    }
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

describe('TaxonomyStore', () => {
    it('upserts sibling nodes by case-insensitive name', async () => {
        const taxonomy = await makeTaxonomyStore()

        const first = await taxonomy.store.upsertNode({
            name: 'Architecture',
            summary: 'System shape',
        })
        const second = await taxonomy.store.upsertNode({
            name: 'architecture',
            summary: 'Updated summary',
        })

        expect(second.id).toBe(first.id)
        expect(second.summary).toBe('Updated summary')
        await taxonomy.close()
    })

    it('loads a bounded subtree from root nodes', async () => {
        const taxonomy = await makeTaxonomyStore()
        const architecture = await taxonomy.store.upsertNode({
            name: 'Architecture',
        })
        const storage = await taxonomy.store.upsertNode({
            name: 'Storage',
            parentId: architecture.id,
        })
        await taxonomy.store.upsertNode({
            name: 'SQLite',
            parentId: storage.id,
        })

        const subtree = await taxonomy.store.getSubtree(undefined, {
            maxDepth: 1,
        })

        expect(subtree.map(node => [node.depth, node.name])).toEqual([
            [0, 'Architecture'],
            [1, 'Storage'],
        ])
        await taxonomy.close()
    })

    it('links taxonomy nodes to memory targets without duplicating links', async () => {
        const taxonomy = await makeTaxonomyStore()
        const node = await taxonomy.store.upsertNode({ name: 'Decisions' })

        const first = await taxonomy.store.linkTarget({
            nodeId: node.id,
            targetId: 'obs_1',
            targetType: 'observation',
        })
        const second = await taxonomy.store.linkTarget({
            nodeId: node.id,
            targetId: 'obs_1',
            targetType: 'observation',
        })
        const links = await taxonomy.store.listLinks(node.id)

        expect(second.id).toBe(first.id)
        expect(links).toEqual([first])
        await taxonomy.close()
    })

    it('returns breadcrumb paths from root to node', async () => {
        const taxonomy = await makeTaxonomyStore()
        const root = await taxonomy.store.upsertNode({ name: 'Project' })
        const feature = await taxonomy.store.upsertNode({
            name: 'Memory',
            parentId: root.id,
        })
        const detail = await taxonomy.store.upsertNode({
            name: 'Graph',
            parentId: feature.id,
        })

        const path = await taxonomy.store.getPath(detail.id)

        expect(path.map(node => node.name)).toEqual([
            'Project',
            'Memory',
            'Graph',
        ])
        await taxonomy.close()
    })
})

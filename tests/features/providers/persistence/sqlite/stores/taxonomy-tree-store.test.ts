import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import { loadProjectContext } from '@/providers/project/context'
import { taxonomyApi } from '../../../../../support/sqlite-action-api'

const tempDirs: string[] = []

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

describe('TaxonomyTreeStore', () => {
    it('loads bounded subtrees and breadcrumb paths', async () => {
        const taxonomy = await makeTaxonomyTreeStore()
        try {
            const root = await taxonomy.nodes.upsertNode({
                name: 'Project',
            })
            const feature = await taxonomy.nodes.upsertNode({
                name: 'Memory',
                parentId: root.id,
            })
            const detail = await taxonomy.nodes.upsertNode({
                name: 'Graph',
                parentId: feature.id,
            })

            const subtree = await taxonomy.tree.getSubtree(undefined, {
                maxDepth: 1,
            })
            const path = await taxonomy.tree.getPath(detail.id)

            expect(subtree.map(node => [node.depth, node.name])).toEqual([
                [0, 'Project'],
                [1, 'Memory'],
            ])
            expect(path.map(node => node.name)).toEqual([
                'Project',
                'Memory',
                'Graph',
            ])
        } finally {
            await taxonomy.close()
        }
    })
})

async function makeTaxonomyTreeStore(): Promise<{
    close: () => Promise<void>
    nodes: ReturnType<typeof taxonomyApi>
    tree: ReturnType<typeof taxonomyApi>
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-tax-tree-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const service = await openProjectDatabase(context)

    return {
        close: () => service.close(),
        nodes: taxonomyApi(service),
        tree: taxonomyApi(service),
    }
}

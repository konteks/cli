import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import TaxonomyLinkStore from '@/providers/persistence/sqlite/stores/taxonomy-link-store'
import TaxonomyNodeStore from '@/providers/persistence/sqlite/stores/taxonomy-node-store'
import { loadProjectContext } from '@/providers/project/context'

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

describe('TaxonomyLinkStore', () => {
    it('links targets idempotently and lists them sorted', async () => {
        const taxonomy = await makeTaxonomyLinkStore()
        try {
            const node = await taxonomy.nodes.upsertNode({
                name: 'Decisions',
            })
            const first = await taxonomy.links.linkTarget({
                nodeId: node.id,
                targetId: 'obs_2',
                targetType: 'observation',
            })
            const second = await taxonomy.links.linkTarget({
                nodeId: node.id,
                targetId: 'obs_2',
                targetType: 'observation',
            })
            const chunk = await taxonomy.links.linkTarget({
                nodeId: node.id,
                targetId: 'chunk_1',
                targetType: 'chunk',
            })

            const links = await taxonomy.links.listLinks(node.id)

            expect(second.id).toBe(first.id)
            expect(links).toEqual([chunk, first])
        } finally {
            await taxonomy.close()
        }
    })
})

async function makeTaxonomyLinkStore(): Promise<{
    close: () => Promise<void>
    links: TaxonomyLinkStore
    nodes: TaxonomyNodeStore
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-tax-link-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const service = await openProjectDatabase(context)

    return {
        close: () => service.close(),
        links: new TaxonomyLinkStore(service.adapter),
        nodes: new TaxonomyNodeStore(service.adapter),
    }
}

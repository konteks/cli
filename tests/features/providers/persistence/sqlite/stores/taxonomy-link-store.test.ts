import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/database/actions/_db'
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
    links: ReturnType<typeof taxonomyApi>
    nodes: ReturnType<typeof taxonomyApi>
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
        links: taxonomyApi(service),
        nodes: taxonomyApi(service),
    }
}

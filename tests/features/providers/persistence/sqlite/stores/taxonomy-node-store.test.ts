import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
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

describe('TaxonomyNodeStore', () => {
    it('upserts sibling nodes by case-insensitive name', async () => {
        const taxonomy = await makeTaxonomyNodeStore()
        try {
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
        } finally {
            await taxonomy.close()
        }
    })
})

async function makeTaxonomyNodeStore(): Promise<{
    close: () => Promise<void>
    store: TaxonomyNodeStore
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-tax-node-test-'))
    tempDirs.push(projectRoot)
    const context = await loadProjectContext(projectRoot)
    const service = await openProjectDatabase(context)

    return {
        close: () => service.close(),
        store: new TaxonomyNodeStore(service.adapter),
    }
}

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withTransaction } from '@/database/actions/_db'
import searchEntities from '@/database/actions/search-entities'
import traverseNeighbors from '@/database/actions/traverse-neighbors'
import { upsertEntity, upsertEntityAliases } from '@/database/services/graph'
import { upsertNode } from '@/database/services/taxonomy'
import persistPreparedFileSections from '@/modules/extraction/engine/persist-prepared-file-sections'
import { extractProject } from '@/modules/extraction/extract-project'
import recallRepositoryMemory from '@/modules/memory/recall-repository-memory'
import { loadProjectContext } from '@/modules/project/context'
import contentHash from '@/support/content-hash'
import FakeEmbeddingProvider from '../../../../fake/fake-embedding-provider'

const tempDirs: string[] = []
const originalCwd = process.cwd()

afterEach(async () => {
    process.chdir(originalCwd)
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('extraction graph', () => {
    it('persists file and symbol graph rows from prepared sections', async () => {
        const projectRoot = await makeProject()
        process.chdir(projectRoot)

        await withTransaction(async () => {
            const root = await upsertNode({ name: 'Project Files' })
            await persistPreparedFileSections({
                extractedAt: '2026-01-01T00:00:00.000Z',
                preparedFile: preparedSymbolFile(),
                rootNodeId: root.id,
            })
        })

        const [fileEntity] = await searchEntities('widgets.ts', { limit: 5 })
        const [symbolEntity] = await searchEntities('GraphWidget', {
            limit: 5,
        })

        expect(fileEntity).toMatchObject({
            canonicalName: 'src/widgets.ts',
            name: 'widgets.ts',
            type: 'file',
        })
        expect(symbolEntity).toMatchObject({
            canonicalName: 'src/widgets.ts#GraphWidget',
            name: 'GraphWidget',
            type: 'symbol',
        })
        await expect(traverseNeighbors(fileEntity.id)).resolves.toEqual([
            expect.objectContaining({
                direction: 'outgoing',
                entity: expect.objectContaining({
                    id: symbolEntity.id,
                    type: 'symbol',
                }),
                predicate: 'defines',
            }),
        ])

        const recall = await recallRepositoryMemory({
            task: 'GraphWidget symbol',
        })
        expect(recall.graph).toEqual([
            expect.objectContaining({
                entityName: 'GraphWidget',
                predicate: 'defines',
                relatedEntityName: 'widgets.ts',
            }),
        ])
    })

    it('creates module graph rows during extraction', async () => {
        const projectRoot = await makeProject()
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'src', 'alpha.txt'),
            'Alpha extraction graph fixture.\n',
        )
        await writeFile(
            join(projectRoot, 'src', 'beta.txt'),
            'Beta extraction graph fixture.\n',
        )
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'rebuild', {
                embeddingProvider: new FakeEmbeddingProvider(),
            }),
        )

        const [moduleEntity] = await withProjectRoot(projectRoot, () =>
            searchEntities('src', { limit: 5 }),
        )
        const neighbors = await withProjectRoot(projectRoot, () =>
            traverseNeighbors(moduleEntity.id, {
                limit: 10,
            }),
        )

        expect(moduleEntity).toMatchObject({
            name: 'src',
            type: 'module',
        })
        expect(neighbors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    direction: 'outgoing',
                    entity: expect.objectContaining({
                        name: 'alpha.txt',
                        type: 'file',
                    }),
                    predicate: 'contains',
                }),
                expect.objectContaining({
                    direction: 'outgoing',
                    entity: expect.objectContaining({
                        name: 'beta.txt',
                        type: 'file',
                    }),
                    predicate: 'contains',
                }),
            ]),
        )

        const recall = await withProjectRoot(projectRoot, () =>
            recallRepositoryMemory({
                task: 'src module alpha',
            }),
        )
        expect(recall.graph).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityName: 'src',
                    predicate: 'contains',
                    relatedEntityName: 'alpha.txt',
                }),
            ]),
        )
    })

    it('cleans stale extraction graph rows and preserves durable graph rows', async () => {
        const projectRoot = await makeProject()
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(join(projectRoot, 'src', 'old.txt'), 'Old file.\n')
        await writeFile(join(projectRoot, 'src', 'keep.txt'), 'Keep file.\n')
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )

        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'rebuild', {
                embeddingProvider: new FakeEmbeddingProvider(),
            }),
        )
        const durable = await withProjectRoot(projectRoot, async () => {
            const entity = await upsertEntity({
                canonicalName: 'durable-cycle-two',
                name: 'durable-cycle-two',
                type: 'memory',
            })
            await upsertEntityAliases(entity.id, ['durable-cycle-two'])
            return entity
        })

        await expect(
            withProjectRoot(projectRoot, () =>
                searchEntities('old.txt', { limit: 5 }),
            ),
        ).resolves.toEqual([
            expect.objectContaining({
                name: 'old.txt',
                type: 'file',
            }),
        ])

        await unlink(join(projectRoot, 'src', 'old.txt'))
        await writeFile(join(projectRoot, 'src', 'new.txt'), 'New file.\n')
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'changed', {
                embeddingProvider: new FakeEmbeddingProvider(),
            }),
        )

        await expect(
            withProjectRoot(projectRoot, () =>
                searchEntities('old.txt', { limit: 5 }),
            ),
        ).resolves.toEqual([])
        await expect(
            withProjectRoot(projectRoot, () =>
                searchEntities('new.txt', { limit: 5 }),
            ),
        ).resolves.toEqual([
            expect.objectContaining({
                name: 'new.txt',
                type: 'file',
            }),
        ])
        await expect(
            withProjectRoot(projectRoot, () =>
                searchEntities('durable-cycle-two', { limit: 5 }),
            ),
        ).resolves.toEqual([
            expect.objectContaining({
                id: durable.id,
                type: 'memory',
            }),
        ])
    })
})

async function makeProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-graph-extract-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    return projectRoot
}

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

function preparedSymbolFile() {
    const content = 'export class GraphWidget {}\n'
    const hash = contentHash(content)
    return {
        language: 'typescript',
        parserEngine: 'test',
        parserStatus: 'ok',
        path: 'src/widgets.ts',
        sections: [
            {
                anchor: 'GraphWidget',
                anchorType: 'symbol',
                contentHash: hash,
                contentInline: content,
                endLine: 1,
                id: 'section_graph_widget',
                kind: 'code',
                metadata: {
                    exported: true,
                    parserEngine: 'test',
                    parserStatus: 'ok',
                },
                path: 'src/widgets.ts',
                retrievalTexts: {
                    embeddingText: content,
                    ftsText: content,
                },
                startLine: 1,
                summary: 'code section from src/widgets.ts#GraphWidget',
                symbol: 'GraphWidget',
                tokenCount: 8,
                topics: ['graph', 'widget'],
            },
        ],
        sourceId: 'source_widgets',
        sourceMetadata: {
            exports: ['GraphWidget'],
            imports: [],
            parserEngine: 'test',
            parserStatus: 'ok',
        },
        sourceRole: 'app_code',
        sourceTopics: ['graph', 'widget'],
        truncated: false,
    }
}

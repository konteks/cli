import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Project } from '@/models/project'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import type DatabaseService from '@/providers/persistence/sqlite/database-service'
import persistPreparedFileSections from './persist-prepared-file-sections'
import type { PreparedFile } from './prepare-file-sections'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('providers/extraction/engine/persist-prepared-file-sections', () => {
    it('stores source, section, taxonomy, search, and retrieval rows', async () => {
        const { db } = await createProject()
        try {
            const rootNode = await db.taxonomy.upsertNode({
                name: 'Project Files',
            })

            const count = await persistPreparedFileSections({
                db,
                extractedAt: '2026-01-01T00:00:00.000Z',
                preparedFile: preparedFile(),
                rootNodeId: rootNode.id,
                taxonomy: db.taxonomy,
            })

            expect(count).toBe(1)
            await expect(
                db.adapter.query('select * from sources where id = ?', [
                    'source_fixture',
                ]),
            ).resolves.toHaveLength(1)
            await expect(
                db.adapter.query('select * from chunks where id = ?', [
                    'chunk_fixture',
                ]),
            ).resolves.toHaveLength(1)
            await expect(
                db.adapter.query(
                    'select * from taxonomy_links where target_id = ?',
                    ['chunk_fixture'],
                ),
            ).resolves.toHaveLength(1)
            await expect(
                db.adapter.query(
                    'select * from retrieval_documents where target_id = ?',
                    ['chunk_fixture'],
                ),
            ).resolves.toHaveLength(1)
            await expect(
                db.adapter.query('select * from memory_fts where id = ?', [
                    'chunk_fixture',
                ]),
            ).resolves.toHaveLength(1)
        } finally {
            await db.close()
        }
    })
})

async function createProject(): Promise<{
    context: Project
    db: DatabaseService
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-persist-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, 'package.json'), '{"type":"module"}\n')

    const context: Project = {
        config: {
            extraction: { grammars: { selected: [], updateTtlHours: 24 } },
            projectRoot,
            recall: { maxTokens: 2000 },
            storage: {
                inlinePayloadMaxBytes: 2048,
                memoryDir: '.konteks',
            },
        },
        configExists: false,
        configPath: join(projectRoot, '.konteks/config.json'),
        memoryDir: join(projectRoot, '.konteks'),
        projectRoot,
    }
    const db = await openProjectDatabase(context)
    return { context: { ...context, configExists: true }, db }
}

function preparedFile(): PreparedFile {
    return {
        language: 'typescript',
        parserEngine: 'heuristic',
        parserStatus: 'not_applicable',
        path: 'src/example.ts',
        sections: [
            {
                anchor: 'alpha',
                anchorType: 'symbol',
                contentHash: 'hash_fixture',
                contentInline: 'export const alpha = 1',
                id: 'chunk_fixture',
                kind: 'code',
                metadata: { parserEngine: 'heuristic' },
                path: 'src/example.ts',
                retrievalTexts: {
                    embeddingText: 'embedding text',
                    ftsText: 'fts text',
                },
                summary: 'code section from src/example.ts#alpha',
                tokenCount: 5,
                topics: ['example'],
            },
        ],
        sourceId: 'source_fixture',
        sourceMetadata: { parserEngine: 'heuristic' },
        sourceRole: 'source',
        sourceTopics: ['example'],
        truncated: false,
    }
}

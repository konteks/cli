// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { querySql } from 'tests/support/sqlite-libsql'
import type { SqliteConnection } from '@/database/actions/_db'
import { openProjectDatabase, withTransaction } from '@/database/actions/_db'
import { upsertNode } from '@/database/services/taxonomy'
import type { Project } from '@/models/project'
import persistPreparedFileSections from '@/providers/extraction/engine/persist-prepared-file-sections'
import type { PreparedFile } from '@/providers/extraction/engine/prepare-file-sections'

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
            const rootNode = await withTransaction(db, () =>
                upsertNode({
                    name: 'Project Files',
                }),
            )

            let count = 0
            await withTransaction(db, async tx => {
                count = await persistPreparedFileSections({
                    db: tx,
                    extractedAt: '2026-01-01T00:00:00.000Z',
                    preparedFile: preparedFile(),
                    rootNodeId: rootNode.id,
                })
            })

            expect(count).toBe(1)
            await expect(
                querySql(db.client, 'select * from sources where id = ?', [
                    'source_fixture',
                ]),
            ).resolves.toHaveLength(1)
            await expect(
                querySql(db.client, 'select * from chunks where id = ?', [
                    'chunk_fixture',
                ]),
            ).resolves.toHaveLength(1)
            await expect(
                querySql(
                    db.client,
                    'select * from taxonomy_links where target_id = ?',
                    ['chunk_fixture'],
                ),
            ).resolves.toHaveLength(1)
            await expect(
                querySql(
                    db.client,
                    'select * from retrieval_documents where target_id = ?',
                    ['chunk_fixture'],
                ),
            ).resolves.toHaveLength(1)
            await expect(
                querySql(db.client, 'select * from memory_fts where id = ?', [
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
    db: SqliteConnection
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

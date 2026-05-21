// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { querySql } from 'tests/support/sqlite-libsql'
import { withTransaction } from '@/database/actions/_db'
import { upsertNode } from '@/database/services/taxonomy'
import type { Project } from '@/models/project'
import persistPreparedFileSections from '@/providers/extraction/engine/persist-prepared-file-sections'
import type { PreparedFile } from '@/providers/extraction/engine/prepare-file-sections'

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

describe('providers/extraction/engine/persist-prepared-file-sections', () => {
    it('stores source, section, taxonomy, search, and retrieval rows', async () => {
        const { context } = await createProject()
        const rootNode = await withTransaction(() =>
            upsertNode({
                name: 'Project Files',
            }),
        )

        let count = 0
        await withTransaction(async () => {
            count = await persistPreparedFileSections({
                extractedAt: '2026-01-01T00:00:00.000Z',
                preparedFile: preparedFile(),
                rootNodeId: rootNode.id,
            })
        })

        expect(count).toBe(1)
        await expect(
            querySql(context, 'select * from sources where id = ?', [
                'source_fixture',
            ]),
        ).resolves.toHaveLength(1)
        await expect(
            querySql(context, 'select * from chunks where id = ?', [
                'chunk_fixture',
            ]),
        ).resolves.toHaveLength(1)
        await expect(
            querySql(
                context,
                'select * from taxonomy_links where target_id = ?',
                ['chunk_fixture'],
            ),
        ).resolves.toHaveLength(1)
        await expect(
            querySql(
                context,
                'select * from retrieval_documents where target_id = ?',
                ['chunk_fixture'],
            ),
        ).resolves.toHaveLength(1)
        await expect(
            querySql(context, 'select * from memory_fts where id = ?', [
                'chunk_fixture',
            ]),
        ).resolves.toHaveLength(1)
    })
})

async function createProject(): Promise<{ context: Project }> {
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
    process.chdir(projectRoot)
    return { context: { ...context, configExists: true } }
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

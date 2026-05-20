// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { querySql } from 'tests/support/sqlite-libsql'
import type { ExtractionProgressEvent } from '@/contracts/services/progress'
import type { SqliteConnection } from '@/database/actions/_db'
import { openProjectDatabase, withTransaction } from '@/database/actions/_db'
import insertChunk from '@/database/actions/insert-chunk'
import insertSource from '@/database/actions/insert-source'
import type { Project } from '@/models/project'
import extractSections from '@/providers/extraction/engine/extract-sections'
import type { ScannedFile } from '@/providers/extraction/engine/file-scan'
import { contentHash } from '@/providers/persistence/objects/content'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('providers/extraction/engine/extract-sections', () => {
    it('extracts markdown sections and reports progress totals', async () => {
        const text = '# Intro\nHello\n\n## Usage\nRun it\n'
        const { context, db } = await createProject({
            path: 'README.md',
            text,
        })
        const events: ExtractionProgressEvent[] = []
        try {
            const result = await extractSections(
                db,
                context,
                [scannedFile('README.md', text)],
                '2026-01-01T00:00:00.000Z',
                {
                    mode: 'full',
                    onProgress: event => events.push(event),
                },
            )

            expect(result).toEqual({
                chunkCount: 2,
                filesTruncatedByChunkLimit: 0,
                loadedParserCount: 0,
                parserFallbackFiles: 0,
                parserUsedFiles: 0,
            })
            expect(
                events.some(
                    event =>
                        event.phase === 'chunks' &&
                        event.status === 'done' &&
                        event.chunkCount === 2,
                ),
            ).toBe(true)
        } finally {
            await db.close()
        }
    })

    it('does not clear existing extracted sections in resume mode', async () => {
        const { context, db } = await createProject({
            path: 'README.md',
            text: '# Intro\nHello\n',
        })
        try {
            await seedExtractedSection(db, 'README.md')

            await extractSections(db, context, [], '2026-01-01T00:00:00.000Z', {
                mode: 'resume',
            })

            await expect(
                querySql(context, 'select * from chunks where id = ?', [
                    'chunk_existing',
                ]),
            ).resolves.toHaveLength(1)
        } finally {
            await db.close()
        }
    })

    it('clears changed and deleted paths before extraction', async () => {
        const { context, db } = await createProject({
            path: 'README.md',
            text: '# Intro\nHello\n',
        })
        try {
            await seedExtractedSection(db, 'src/deleted.ts')

            await extractSections(db, context, [], '2026-01-01T00:00:00.000Z', {
                deletedPaths: ['src/deleted.ts'],
                mode: 'changed',
            })

            await expect(
                querySql(context, 'select * from chunks where id = ?', [
                    'chunk_existing',
                ]),
            ).resolves.toHaveLength(0)
        } finally {
            await db.close()
        }
    })
})

async function createProject(input: {
    path: string
    text: string
}): Promise<{ context: Project; db: SqliteConnection }> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-store-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await mkdir(join(projectRoot, input.path, '..'), { recursive: true })
    await writeFile(join(projectRoot, 'package.json'), '{"type":"module"}\n')
    await writeFile(join(projectRoot, input.path), input.text)

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

function scannedFile(path: string, text: string): ScannedFile {
    return {
        contentHash: contentHash(text),
        mtimeMs: 0,
        path,
        sizeBytes: Buffer.byteLength(text),
    }
}

async function seedExtractedSection(
    db: SqliteConnection,
    path: string,
): Promise<void> {
    await withTransaction(db, () =>
        insertSource({
            entities_json: JSON.stringify([]),
            excerpt_ref: null,
            id: 'source_existing',
            language: 'typescript',
            metadata_json: JSON.stringify({}),
            source_role: 'source',
            topics_json: JSON.stringify([]),
            type: 'mined_file',
            uri: path,
        }),
    )
    await withTransaction(db, () =>
        insertChunk({
            anchor: 'file',
            anchor_type: 'file',
            content_hash: 'hash_existing',
            content_inline: 'existing',
            end_line: null,
            entities_json: JSON.stringify([]),
            heading: null,
            id: 'chunk_existing',
            json_path: null,
            kind: 'code',
            language: 'typescript',
            metadata_json: JSON.stringify({}),
            path,
            payload_ref: null,
            source_id: 'source_existing',
            source_role: 'source',
            start_line: null,
            summary: 'existing section',
            symbol: null,
            token_count: 1,
            topics_json: JSON.stringify([]),
        }),
    )
}

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Project } from '@/models/project'
import { contentHash } from '@/providers/persistence/objects/content'
import { createToonStore } from '@/providers/persistence/objects/toon-store'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import type { DatabaseService } from '@/providers/persistence/sqlite/db'
import { FakeTreeSitterEngine } from '@/support/fake/fake-tree-sitter-engine'
import { prepareFileChunks } from './chunk-preparation'
import type { ScannedFile } from './file-scan'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('providers/extraction/engine/chunk-preparation', () => {
    it('prepares source metadata and stable chunk identifiers', async () => {
        const { context, db } = await createProject({
            path: 'src/example.ts',
            text: 'export const alpha = 1\n',
        })
        try {
            const prepared = await prepareFileChunks({
                context,
                db,
                engine: new FakeTreeSitterEngine() as never,
                file: scannedFile('src/example.ts', 'export const alpha = 1\n'),
                toonStore: createToonStore(context.memoryDir),
            })

            expect(prepared.sourceId).toMatch(/^source_/u)
            expect(prepared.sourceMetadata).toMatchObject({
                parserEngine: 'tree_sitter',
                parserStatus: 'ok',
            })
            expect(prepared.chunks).toHaveLength(1)
            expect(prepared.chunks[0]?.id).toMatch(/^chunk_/u)
            expect(prepared.chunks[0]?.metadata).toMatchObject({
                parserEngine: 'tree_sitter',
                parserStatus: 'ok',
            })
            expect(prepared.chunks[0]?.retrievalTexts.ftsText).toContain(
                'src/example.ts',
            )
        } finally {
            await db.close()
        }
    })

    it('stores large chunk content out of line when inline limit is small', async () => {
        const text = `# Large\n${'large content '.repeat(80)}`
        const { context, db } = await createProject({
            inlinePayloadMaxBytes: 16,
            path: 'README.md',
            text,
        })
        try {
            const prepared = await prepareFileChunks({
                context,
                db,
                file: scannedFile('README.md', text),
                toonStore: createToonStore(context.memoryDir),
            })

            expect(prepared.chunks[0]?.contentInline).toBeUndefined()
            expect(prepared.chunks[0]?.payloadRef).toMatch(/^objects\//u)
        } finally {
            await db.close()
        }
    })

    it('skips chunks that match stored suppressions', async () => {
        const text = '# Suppressed\nDo not index this section.\n'
        const { context, db } = await createProject({
            path: 'README.md',
            text,
        })
        try {
            const first = await prepareFileChunks({
                context,
                db,
                file: scannedFile('README.md', text),
                toonStore: createToonStore(context.memoryDir),
            })
            expect(first.chunks).toHaveLength(1)

            await db.adapter.execute(
                `
insert into mined_suppressions (
    path,
    anchor,
    content_hash,
    reason,
    created_at
) values (?, ?, ?, ?, ?)
`,
                [
                    'README.md',
                    'suppressed',
                    contentHash(text.trim()),
                    'test',
                    new Date().toISOString(),
                ],
            )

            const suppressed = await prepareFileChunks({
                context,
                db,
                file: scannedFile('README.md', text),
                toonStore: createToonStore(context.memoryDir),
            })

            expect(suppressed.chunks).toEqual([])
        } finally {
            await db.close()
        }
    })
})

async function createProject(input: {
    inlinePayloadMaxBytes?: number
    path: string
    text: string
}): Promise<{ context: Project; db: DatabaseService }> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-chunks-'))
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
                inlinePayloadMaxBytes: input.inlinePayloadMaxBytes ?? 2048,
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

// @ts-nocheck
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SqliteConnection } from '@/database/actions/_db'
import { openProjectDatabase, withTransaction } from '@/database/actions/_db'
import insertMinedSuppression from '@/database/actions/insert-mined-suppression'
import type { Project } from '@/models/project'
import type { ScannedFile } from '@/providers/extraction/engine/file-scan'
import prepareFileSections from '@/providers/extraction/engine/prepare-file-sections'
import { contentHash } from '@/providers/persistence/objects/content'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import FakeTreeSitterEngine from '../../../../fake/fake-tree-sitter-engine'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('providers/extraction/engine/prepare-file-sections', () => {
    it('prepares source metadata and stable section identifiers', async () => {
        const { context, db } = await createProject({
            path: 'src/example.ts',
            selectedGrammars: ['typescript'],
            text: 'export const alpha = 1\n',
        })
        try {
            const prepared = await prepareFileSections({
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
            expect(prepared.sections).toHaveLength(1)
            expect(prepared.sections[0]?.id).toMatch(/^chunk_/u)
            expect(prepared.sections[0]?.metadata).toMatchObject({
                parserEngine: 'tree_sitter',
                parserStatus: 'ok',
            })
            expect(prepared.sections[0]?.retrievalTexts.ftsText).toContain(
                'src/example.ts',
            )
        } finally {
            await db.close()
        }
    })

    it('extracts built-in JSON files without user grammar selection', async () => {
        const text = '{"name":"fixture","type":"module"}\n'
        const { context, db } = await createProject({
            path: 'package.json',
            text,
        })
        try {
            const prepared = await prepareFileSections({
                context,
                db,
                engine: new FakeTreeSitterEngine() as never,
                file: scannedFile('package.json', text),
                toonStore: createToonStore(context.memoryDir),
            })

            expect(prepared.parserEngine).toBe('tree_sitter')
            expect(prepared.parserStatus).toBe('ok')
            expect(prepared.sections.map(section => section.anchor)).toEqual([
                'name',
                'type',
            ])
            expect(prepared.sourceMetadata).toMatchObject({
                parserEngine: 'tree_sitter',
                parserStatus: 'ok',
            })
        } finally {
            await db.close()
        }
    })

    it('reports unloaded bundled grammars without selection guidance', async () => {
        const text = '{"name":"fixture"}\n'
        const { context, db } = await createProject({
            path: 'package.json',
            text,
        })
        try {
            await expect(
                prepareFileSections({
                    context,
                    db,
                    file: scannedFile('package.json', text),
                    toonStore: createToonStore(context.memoryDir),
                }),
            ).rejects.toThrow(
                'Tree-sitter grammar "json" is required for package.json. Bundled JSON grammar was not loaded before extraction.',
            )
        } finally {
            await db.close()
        }
    })

    it('skips non-built-in grammar files that are not selected', async () => {
        const text = 'export const skipped = true\n'
        const { context, db } = await createProject({
            path: 'src/skipped.ts',
            text,
        })
        try {
            const prepared = await prepareFileSections({
                context,
                db,
                engine: new FakeTreeSitterEngine() as never,
                file: scannedFile('src/skipped.ts', text),
                toonStore: createToonStore(context.memoryDir),
            })

            expect(prepared.sections).toEqual([])
            expect(prepared.parserStatus).toBe('skipped_unselected_grammar')
            expect(prepared.sourceMetadata).toMatchObject({
                parserStatus: 'skipped_unselected_grammar',
            })
        } finally {
            await db.close()
        }
    })

    it('fails when a selected grammar is not loaded', async () => {
        const text = 'export const missing = true\n'
        const { context, db } = await createProject({
            path: 'src/missing.ts',
            selectedGrammars: ['typescript'],
            text,
        })
        try {
            await expect(
                prepareFileSections({
                    context,
                    db,
                    file: scannedFile('src/missing.ts', text),
                    toonStore: createToonStore(context.memoryDir),
                }),
            ).rejects.toThrow(
                'Tree-sitter grammar "typescript" is required for src/missing.ts',
            )
        } finally {
            await db.close()
        }
    })

    it('stores large section content out of line when inline limit is small', async () => {
        const text = `# Large\n${'large content '.repeat(80)}`
        const { context, db } = await createProject({
            inlinePayloadMaxBytes: 16,
            path: 'README.md',
            text,
        })
        try {
            const prepared = await prepareFileSections({
                context,
                db,
                file: scannedFile('README.md', text),
                toonStore: createToonStore(context.memoryDir),
            })

            expect(prepared.sections[0]?.contentInline).toBeUndefined()
            expect(prepared.sections[0]?.payloadRef).toMatch(/^objects\//u)
        } finally {
            await db.close()
        }
    })

    it('skips sections that match stored suppressions', async () => {
        const text = '# Suppressed\nDo not index this section.\n'
        const { context, db } = await createProject({
            path: 'README.md',
            text,
        })
        try {
            const first = await prepareFileSections({
                context,
                db,
                file: scannedFile('README.md', text),
                toonStore: createToonStore(context.memoryDir),
            })
            expect(first.sections).toHaveLength(1)

            await withTransaction(db, () =>
                insertMinedSuppression({
                    anchor: 'suppressed',
                    contentHash: contentHash(text.trim()),
                    createdAt: new Date().toISOString(),
                    path: 'README.md',
                    reason: 'test',
                }),
            )

            const suppressed = await prepareFileSections({
                context,
                db,
                file: scannedFile('README.md', text),
                toonStore: createToonStore(context.memoryDir),
            })

            expect(suppressed.sections).toEqual([])
        } finally {
            await db.close()
        }
    })
})

async function createProject(input: {
    inlinePayloadMaxBytes?: number
    path: string
    selectedGrammars?: string[]
    text: string
}): Promise<{ context: Project; db: SqliteConnection }> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-sections-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await mkdir(join(projectRoot, input.path, '..'), { recursive: true })
    await writeFile(join(projectRoot, 'package.json'), '{"type":"module"}\n')
    await writeFile(join(projectRoot, input.path), input.text)

    const context: Project = {
        config: {
            extraction: {
                grammars: {
                    selected: input.selectedGrammars ?? [],
                    updateTtlHours: 24,
                },
            },
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

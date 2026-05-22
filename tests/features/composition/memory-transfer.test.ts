import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import BackupCommand from '@/entrypoints/cli/commands/backup-command'
import {
    exportMemory,
    importMemory,
    restoreMemory,
} from '@/modules/memory/memory-transfer'
import { saveDiary, saveMemories } from '@/modules/memory/save-memory'

const tempDirs: string[] = []
let previousSqliteTestDatabase: string | undefined

async function makeInitializedProject(prefix = 'konteks-transfer-test-') {
    const projectRoot = await mkdtemp(join(tmpdir(), prefix))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    return projectRoot
}

beforeEach(() => {
    previousSqliteTestDatabase = process.env.KONTEKS_SQLITE_TEST_DATABASE
    process.env.KONTEKS_SQLITE_TEST_DATABASE = 'file'
})

afterEach(async () => {
    if (previousSqliteTestDatabase === undefined) {
        delete process.env.KONTEKS_SQLITE_TEST_DATABASE
    } else {
        process.env.KONTEKS_SQLITE_TEST_DATABASE = previousSqliteTestDatabase
    }

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

describe('memory transfer', () => {
    it('exports durable memories and diaries as portable JSON', async () => {
        const projectRoot = await makeInitializedProject()
        await withProjectRoot(projectRoot, async () => {
            await saveMemories({
                memories: [
                    {
                        content:
                            'Portable export includes durable memory content stored in SQLite.',
                        importance: 3,
                        kind: 'decision',
                    },
                ],
            })
            await saveDiary({
                subject: 'portable export',
                summary: 'Durable diary entries are included in JSON exports.',
                tags: ['export'],
            })
        })

        const outputPath = join(projectRoot, 'memory-export.json')
        const result = await withProjectRoot(projectRoot, () =>
            exportMemory({ outputPath }),
        )
        const payload = JSON.parse(await readFile(outputPath, 'utf8'))

        expect(result).toMatchObject({ diaries: 1, memories: 1 })
        expect(payload.format).toBe('konteks.durable-memory.v1')
        expect(payload.memories[0].content).toContain(
            'Portable export includes durable memory content',
        )
        expect(payload.diaries[0]).toMatchObject({
            subject: 'portable export',
            tags: ['export'],
        })
    })

    it('imports durable memory, rebuilds search indexes, and skips duplicates', async () => {
        const sourceRoot = await makeInitializedProject('konteks-transfer-src-')
        await withProjectRoot(sourceRoot, async () => {
            await saveMemories({
                memories: [
                    {
                        content:
                            'Imported durable memory should be searchable by recall.',
                        importance: 3,
                        kind: 'code_insight',
                    },
                ],
            })
            await saveDiary({
                subject: 'import diary',
                summary: 'Imported diary entries should also be searchable.',
                tags: ['import'],
            })
        })

        const exportPath = join(sourceRoot, 'memory-export.json')
        await withProjectRoot(sourceRoot, () =>
            exportMemory({ outputPath: exportPath }),
        )

        const targetRoot = await makeInitializedProject('konteks-transfer-dst-')
        const dryRun = await withProjectRoot(targetRoot, () =>
            importMemory({
                dryRun: true,
                inputPath: exportPath,
            }),
        )
        const dryRunExportPath = join(targetRoot, 'dry-run-export.json')
        const dryRunExport = await withProjectRoot(targetRoot, () =>
            exportMemory({ outputPath: dryRunExportPath }),
        )
        const dryRunPayload = JSON.parse(
            await readFile(dryRunExportPath, 'utf8'),
        )

        expect(dryRun).toMatchObject({
            diariesImported: 1,
            dryRun: true,
            memoriesImported: 1,
        })
        expect(dryRunExport).toMatchObject({ diaries: 0, memories: 0 })
        expect(dryRunPayload.memories).toEqual([])

        const imported = await withProjectRoot(targetRoot, () =>
            importMemory({
                inputPath: exportPath,
            }),
        )
        const duplicate = await withProjectRoot(targetRoot, () =>
            importMemory({
                inputPath: exportPath,
            }),
        )
        const importedExportPath = join(targetRoot, 'imported-export.json')
        const importedExport = await withProjectRoot(targetRoot, () =>
            exportMemory({ outputPath: importedExportPath }),
        )
        const importedPayload = JSON.parse(
            await readFile(importedExportPath, 'utf8'),
        )

        expect(imported).toMatchObject({
            diariesImported: 1,
            memoriesImported: 1,
        })
        expect(duplicate).toMatchObject({
            diariesSkipped: 1,
            memoriesSkipped: 1,
        })
        expect(importedExport).toMatchObject({ diaries: 1, memories: 1 })
        expect(importedPayload.memories[0].content).toContain(
            'Imported durable memory should be searchable by recall.',
        )
    })

    it('rejects unsupported durable memory export formats', async () => {
        const projectRoot = await makeInitializedProject()
        const inputPath = join(projectRoot, 'bad-export.json')
        await writeFile(
            inputPath,
            JSON.stringify({
                diaries: [],
                format: 'konteks.durable-memory.v999',
                memories: [],
            }),
        )

        await expect(
            withProjectRoot(projectRoot, () => importMemory({ inputPath })),
        ).rejects.toThrow('Expected format "konteks.durable-memory.v1"')
    })

    it('backs up and restores the full memory directory archive', async () => {
        const projectRoot = await makeInitializedProject('konteks-backup-src-')
        await withProjectRoot(projectRoot, async () => {
            await saveMemories({
                memories: [
                    {
                        content:
                            'Full backup should restore the exact memory database.',
                        importance: 3,
                        kind: 'fact',
                    },
                ],
            })
        })

        const archivePath = join(projectRoot, 'konteks-backup.tar.gz')
        await withProjectRoot(projectRoot, () =>
            new BackupCommand().handle({
                args: [archivePath],
                options: {},
            }),
        )
        await rm(join(projectRoot, '.konteks'), {
            force: true,
            recursive: true,
        })

        await withProjectRoot(projectRoot, () =>
            restoreMemory({ inputPath: archivePath }),
        )
        const exportPath = join(projectRoot, 'restored-export.json')
        const exported = await withProjectRoot(projectRoot, () =>
            exportMemory({ outputPath: exportPath }),
        )
        const payload = JSON.parse(await readFile(exportPath, 'utf8'))

        expect(exported).toMatchObject({ memories: 1 })
        expect(payload.memories[0].content).toContain(
            'Full backup should restore the exact memory database.',
        )
    })

    it('refuses restore over non-empty memory unless forced and creates a safety backup', async () => {
        const sourceRoot = await makeInitializedProject('konteks-backup-src-')
        await withProjectRoot(sourceRoot, async () => {
            await saveMemories({
                memories: [
                    {
                        content:
                            'Backup source memory content is intentionally distinct.',
                        importance: 3,
                        kind: 'fact',
                    },
                ],
            })
        })
        const archivePath = join(sourceRoot, 'konteks-backup.tar.gz')
        await withProjectRoot(sourceRoot, () =>
            new BackupCommand().handle({
                args: [archivePath],
                options: {},
            }),
        )

        const targetRoot = await makeInitializedProject('konteks-backup-dst-')
        await expect(
            withProjectRoot(targetRoot, () =>
                restoreMemory({ inputPath: archivePath }),
            ),
        ).rejects.toThrow('not empty')

        const restored = await withProjectRoot(targetRoot, () =>
            restoreMemory({
                force: true,
                inputPath: archivePath,
            }),
        )
        expect(restored.safetyBackupPath).toBeString()
        expect(await readdir(join(targetRoot, '.konteks'))).toContain(
            'memory.sqlite',
        )
    })
})

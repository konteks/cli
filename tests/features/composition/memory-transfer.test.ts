// @ts-nocheck
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
import BackupCommand from '@/commands/backup-command'
import {
    exportMemory,
    importMemory,
    restoreMemory,
} from '@/composition/memory-transfer'
import { openProjectDatabase } from '@/database/actions/_db'
import searchMemory from '@/database/services/search-memory'
import {
    executeSql,
    querySql,
} from '@/providers/persistence/sqlite/libsql-helpers'
import {
    saveKonteksDiary,
    saveKonteksMemory,
} from '@/providers/persistence/sqlite/save-konteks-input'
import { loadProjectContext } from '@/providers/project/context'

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
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        context.config.storage.inlinePayloadMaxBytes = 8
        const db = await openProjectDatabase(context)
        await saveKonteksMemory(db, context, {
            content:
                'Portable export must resolve large durable memory payloads from object storage.',
            importance: 3,
            kind: 'decision',
        })
        await saveKonteksDiary(db, context, {
            subject: 'portable export',
            summary: 'Durable diary entries are included in JSON exports.',
            tags: ['export'],
        })
        await db.close()

        const outputPath = join(projectRoot, 'memory-export.json')
        const result = await withProjectRoot(projectRoot, () =>
            exportMemory({ outputPath }),
        )
        const payload = JSON.parse(await readFile(outputPath, 'utf8'))

        expect(result).toMatchObject({ diaries: 1, memories: 1 })
        expect(payload.format).toBe('konteks.durable-memory.v1')
        expect(payload.memories[0].content).toContain(
            'Portable export must resolve large durable memory payloads',
        )
        expect(payload.diaries[0]).toMatchObject({
            subject: 'portable export',
            tags: ['export'],
        })
    })

    it('imports durable memory, rebuilds search indexes, and skips duplicates', async () => {
        const sourceRoot = await makeInitializedProject('konteks-transfer-src-')
        const sourceContext = await withProjectRoot(sourceRoot, () =>
            loadProjectContext(),
        )
        const sourceDb = await openProjectDatabase(sourceContext)
        await saveKonteksMemory(sourceDb, sourceContext, {
            content: 'Imported durable memory should be searchable by recall.',
            importance: 3,
            kind: 'code_insight',
        })
        await saveKonteksDiary(sourceDb, sourceContext, {
            subject: 'import diary',
            summary: 'Imported diary entries should also be searchable.',
            tags: ['import'],
        })
        await sourceDb.close()

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
        let targetDb = await openProjectDatabase(
            await withProjectRoot(targetRoot, () => loadProjectContext()),
        )
        const rows = await querySql<{ count: number }>(
            targetDb.client,
            'select count(*) as count from observations',
        )
        await targetDb.close()

        expect(dryRun).toMatchObject({
            diariesImported: 1,
            dryRun: true,
            memoriesImported: 1,
        })
        expect(rows[0]?.count).toBe(0)

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
        targetDb = await openProjectDatabase(
            await withProjectRoot(targetRoot, () => loadProjectContext()),
        )
        const results = await withProjectRoot(targetRoot, () =>
            searchMemory(targetDb, {
                limit: 5,
                query: 'searchable recall',
            }),
        )
        await targetDb.close()

        expect(imported).toMatchObject({
            diariesImported: 1,
            memoriesImported: 1,
        })
        expect(duplicate).toMatchObject({
            diariesSkipped: 1,
            memoriesSkipped: 1,
        })
        expect(results.some(result => result.type === 'memory')).toBe(true)
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

    it('exports inactive durable memory only when requested', async () => {
        const projectRoot = await makeInitializedProject()
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        const db = await openProjectDatabase(context)
        const saved = await saveKonteksMemory(db, context, {
            content: 'Inactive memory should require an explicit export flag.',
            importance: 3,
            kind: 'note',
        })
        await executeSql(
            db.client,
            'update observations set suppressed_at = ?, forget_reason = ? where id = ?',
            [new Date().toISOString(), 'test inactive export', saved.id],
        )
        await db.close()

        const activeOnlyPath = join(projectRoot, 'active.json')
        const inactivePath = join(projectRoot, 'inactive.json')
        await withProjectRoot(projectRoot, () =>
            exportMemory({ outputPath: activeOnlyPath }),
        )
        await withProjectRoot(projectRoot, () =>
            exportMemory({
                includeInactive: true,
                outputPath: inactivePath,
            }),
        )

        const activeOnly = JSON.parse(await readFile(activeOnlyPath, 'utf8'))
        const withInactive = JSON.parse(await readFile(inactivePath, 'utf8'))
        expect(activeOnly.memories).toHaveLength(0)
        expect(withInactive.memories).toHaveLength(1)
        expect(withInactive.memories[0].suppressedAt).toBeString()
    })

    it('backs up and restores the full memory directory archive', async () => {
        const projectRoot = await makeInitializedProject('konteks-backup-src-')
        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        const db = await openProjectDatabase(context)
        await saveKonteksMemory(db, context, {
            content: 'Full backup should restore the exact memory database.',
            importance: 3,
            kind: 'fact',
        })
        await db.close()

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
        const restoredDb = await openProjectDatabase(
            await withProjectRoot(projectRoot, () => loadProjectContext()),
        )
        const rows = await querySql<{ count: number }>(
            restoredDb.client,
            'select count(*) as count from observations',
        )
        await restoredDb.close()

        expect(rows[0]?.count).toBe(1)
    })

    it('refuses restore over non-empty memory unless forced and creates a safety backup', async () => {
        const sourceRoot = await makeInitializedProject('konteks-backup-src-')
        const sourceDb = await openProjectDatabase(
            await withProjectRoot(sourceRoot, () => loadProjectContext()),
        )
        await saveKonteksMemory(
            sourceDb,
            await withProjectRoot(sourceRoot, () => loadProjectContext()),
            {
                content:
                    'Backup source memory content is intentionally distinct.',
                importance: 3,
                kind: 'fact',
            },
        )
        await sourceDb.close()
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

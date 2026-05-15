import { afterEach, describe, expect, it } from 'bun:test'
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
import {
    backupMemory,
    exportMemory,
    importMemory,
    restoreMemory,
} from '@/composition/memory-transfer'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import saveKonteksInput from '@/providers/persistence/sqlite/save-konteks-input'
import searchMemory from '@/providers/persistence/sqlite/search-memory'
import { loadProjectContext } from '@/providers/project/context'

const tempDirs: string[] = []

async function makeInitializedProject(prefix = 'konteks-transfer-test-') {
    const projectRoot = await mkdtemp(join(tmpdir(), prefix))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })
    await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
    return projectRoot
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('memory transfer', () => {
    it('exports durable memories and diaries as portable JSON', async () => {
        const projectRoot = await makeInitializedProject()
        const context = await loadProjectContext(projectRoot)
        context.config.storage.inlinePayloadMaxBytes = 8
        const db = await openProjectDatabase(context)
        await saveKonteksInput(db, context, {
            content:
                'Portable export must resolve large durable memory payloads from object storage.',
            kind: 'decision',
            type: 'memory',
        })
        await saveKonteksInput(db, context, {
            subject: 'portable export',
            summary: 'Durable diary entries are included in JSON exports.',
            tags: ['export'],
            type: 'diary',
        })
        await db.close()

        const outputPath = join(projectRoot, 'memory-export.json')
        const result = await exportMemory({ outputPath, project: projectRoot })
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
        const sourceContext = await loadProjectContext(sourceRoot)
        const sourceDb = await openProjectDatabase(sourceContext)
        await saveKonteksInput(sourceDb, sourceContext, {
            content: 'Imported durable memory should be searchable by recall.',
            kind: 'code_insight',
            type: 'memory',
        })
        await saveKonteksInput(sourceDb, sourceContext, {
            subject: 'import diary',
            summary: 'Imported diary entries should also be searchable.',
            tags: ['import'],
            type: 'diary',
        })
        await sourceDb.close()

        const exportPath = join(sourceRoot, 'memory-export.json')
        await exportMemory({ outputPath: exportPath, project: sourceRoot })

        const targetRoot = await makeInitializedProject('konteks-transfer-dst-')
        const dryRun = await importMemory({
            dryRun: true,
            inputPath: exportPath,
            project: targetRoot,
        })
        let targetDb = await openProjectDatabase(
            await loadProjectContext(targetRoot),
        )
        const rows = await targetDb.adapter.query<{ count: number }>(
            'select count(*) as count from observations',
        )
        await targetDb.close()

        expect(dryRun).toMatchObject({
            diariesImported: 1,
            dryRun: true,
            memoriesImported: 1,
        })
        expect(rows[0]?.count).toBe(0)

        const imported = await importMemory({
            inputPath: exportPath,
            project: targetRoot,
        })
        const duplicate = await importMemory({
            inputPath: exportPath,
            project: targetRoot,
        })
        targetDb = await openProjectDatabase(
            await loadProjectContext(targetRoot),
        )
        const results = await searchMemory(targetDb, {
            limit: 5,
            query: 'searchable recall',
        })
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
            importMemory({ inputPath, project: projectRoot }),
        ).rejects.toThrow('Expected format "konteks.durable-memory.v1"')
    })

    it('exports inactive durable memory only when requested', async () => {
        const projectRoot = await makeInitializedProject()
        const context = await loadProjectContext(projectRoot)
        const db = await openProjectDatabase(context)
        const saved = await saveKonteksInput(db, context, {
            content: 'Inactive memory should require an explicit export flag.',
            kind: 'note',
            type: 'memory',
        })
        await db.adapter.execute(
            'update observations set suppressed_at = ?, forget_reason = ? where id = ?',
            [new Date().toISOString(), 'test inactive export', saved.id],
        )
        await db.close()

        const activeOnlyPath = join(projectRoot, 'active.json')
        const inactivePath = join(projectRoot, 'inactive.json')
        await exportMemory({ outputPath: activeOnlyPath, project: projectRoot })
        await exportMemory({
            includeInactive: true,
            outputPath: inactivePath,
            project: projectRoot,
        })

        const activeOnly = JSON.parse(await readFile(activeOnlyPath, 'utf8'))
        const withInactive = JSON.parse(await readFile(inactivePath, 'utf8'))
        expect(activeOnly.memories).toHaveLength(0)
        expect(withInactive.memories).toHaveLength(1)
        expect(withInactive.memories[0].suppressedAt).toBeString()
    })

    it('backs up and restores the full memory directory archive', async () => {
        const projectRoot = await makeInitializedProject('konteks-backup-src-')
        const context = await loadProjectContext(projectRoot)
        const db = await openProjectDatabase(context)
        await saveKonteksInput(db, context, {
            content: 'Full backup should restore the exact memory database.',
            kind: 'fact',
            type: 'memory',
        })
        await db.close()

        const archivePath = join(projectRoot, 'konteks-backup.tar.gz')
        await backupMemory({ outputPath: archivePath, project: projectRoot })
        await rm(join(projectRoot, '.konteks'), {
            force: true,
            recursive: true,
        })

        await restoreMemory({ inputPath: archivePath, project: projectRoot })
        const restoredDb = await openProjectDatabase(
            await loadProjectContext(projectRoot),
        )
        const rows = await restoredDb.adapter.query<{ count: number }>(
            'select count(*) as count from observations',
        )
        await restoredDb.close()

        expect(rows[0]?.count).toBe(1)
    })

    it('refuses restore over non-empty memory unless forced and creates a safety backup', async () => {
        const sourceRoot = await makeInitializedProject('konteks-backup-src-')
        const sourceDb = await openProjectDatabase(
            await loadProjectContext(sourceRoot),
        )
        await saveKonteksInput(sourceDb, await loadProjectContext(sourceRoot), {
            content: 'Backup source memory content is intentionally distinct.',
            kind: 'fact',
            type: 'memory',
        })
        await sourceDb.close()
        const archivePath = join(sourceRoot, 'konteks-backup.tar.gz')
        await backupMemory({ outputPath: archivePath, project: sourceRoot })

        const targetRoot = await makeInitializedProject('konteks-backup-dst-')
        await expect(
            restoreMemory({ inputPath: archivePath, project: targetRoot }),
        ).rejects.toThrow('not empty')

        const restored = await restoreMemory({
            force: true,
            inputPath: archivePath,
            project: targetRoot,
        })
        expect(restored.safetyBackupPath).toBeString()
        expect(await readdir(join(targetRoot, '.konteks'))).toContain(
            'memory.sqlite',
        )
    })
})

import { afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { extractProject } from '@/modules/extraction/extract-project'
import { saveDiary, saveMemories } from '@/modules/memory/save-memory'
import {
    loadProjectContext,
    writeProjectConfig,
} from '@/modules/project/context'
import { mkdir, rm as rmRecursive } from '@/support/file-manager'
import getVersion from '@/support/get-version'
import type { DurableMemoryExport } from '@/types/memory-transfer'
import FakeEmbeddingProvider from '../fake/fake-embedding-provider'
import { isolatedCommandEnv, runBuiltCli as runKonteks } from '../support/cli'
import { withWorkingDirectory as withProjectRoot } from '../support/project'

const execFileAsync = promisify(execFile)
const tempDirs: string[] = []
const repoRoot = process.cwd()

beforeAll(async () => {
    await execFileAsync('bun', ['run', 'build'], {
        cwd: repoRoot,
        env: isolatedCommandEnv(process.env.HOME ?? repoRoot),
    })
})

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(path => rmRecursive(path)))
})

describe('cli/e2e', () => {
    it('reports already-initialized on a seeded project', async () => {
        const fixture = await createInitializedProject()

        const result = await runKonteks(fixture.projectRoot, ['init'])

        expect(result.exitCode).toBe(0)
        expect(result.output).toContain(`Konteks  v${getVersion()}`)
        expect(result.output).toContain('██████')
        expect(result.output).toContain('Project memory is already ready at')
        expect(result.output).toContain('.konteks')
    }, 20000)

    it('prints status for initialized projects and reports changed files', async () => {
        const fixture = await createInitializedProject()

        const initial = await runKonteks(fixture.projectRoot, ['status'])
        expect(initial.exitCode).toBe(0)
        expect(initial.output).toContain('██████')
        expect(initial.output).toContain(`Konteks  v${getVersion()}`)
        expect(initial.output).toContain(fixture.projectRoot)
        expect(initial.output).toContain(join(fixture.projectRoot, '.konteks'))
        expect(initial.output).toContain('Status        up-to-date')
        expect(initial.output).toContain('Last indexed')
        expect(initial.output).toContain('Source files')
        expect(initial.output).toContain('Vectors')
        expect(initial.output).toContain('DERIVED MEMORY')
        expect(initial.output).toContain('Modules')
        expect(initial.output).toContain('Sections')
        expect(initial.output).toContain('DURABLE MEMORY')
        expect(initial.output).toContain('Memories')
        expect(initial.output).toContain('Diary entries')

        await writeFile(
            join(fixture.projectRoot, 'README.md'),
            '# Fixture\nChanged after init.\n',
        )

        const changed = await runKonteks(fixture.projectRoot, ['status'])
        expect(changed.exitCode).toBe(0)
        expect(changed.output).toContain('Status        STALE')
    }, 20000)

    it('backs up memory, refuses restore without force, and restores with force', async () => {
        const source = await createInitializedProject({ seededMemory: true })
        const target = await createInitializedProject({ seededMemory: true })
        const archivePath = join(source.projectRoot, 'backup.tar.gz')

        const backup = await runKonteks(source.projectRoot, [
            'backup',
            archivePath,
        ])
        expect(backup.exitCode).toBe(0)
        expect(backup.output).toContain(archivePath)
        expect(await Bun.file(archivePath).exists()).toBe(true)

        const refused = await runKonteks(target.projectRoot, [
            'restore',
            archivePath,
        ])
        expect(refused.exitCode).not.toBe(0)
        expect(refused.output).toContain('Restore refused')
        expect(refused.output).toContain('--force')

        const restored = await runKonteks(target.projectRoot, [
            'restore',
            archivePath,
            '--force',
        ])
        expect(restored.exitCode).toBe(0)
        expect(restored.output).toContain(archivePath)
        expect(restored.output).toContain(join(target.projectRoot, '.konteks'))
        expect(restored.output).toContain('.safety-')

        const safetyBackupPaths = await readdir(source.projectRoot)
        expect(safetyBackupPaths.some(path => path.includes('.safety-'))).toBe(
            true,
        )

        expect(await readActiveCounts(target.projectRoot)).toEqual(
            await readActiveCounts(source.projectRoot),
        )
    }, 20000)

    it('exports durable memory and supports import dry-run plus real import', async () => {
        const source = await createInitializedProject({ seededMemory: true })
        const target = await createInitializedProject()
        const exportPath = join(source.projectRoot, 'memory-export.json')

        const exported = await runKonteks(source.projectRoot, [
            'memory',
            'export',
            exportPath,
        ])
        expect(exported.exitCode).toBe(0)
        expect(exported.output).toContain('diaries: 1')
        expect(exported.output).toContain('memories: 1')
        expect(exported.output).toContain(exportPath)

        const payload = JSON.parse(
            await readFile(exportPath, 'utf8'),
        ) as DurableMemoryExport
        expect(payload.format).toBe('konteks.durable-memory.v1')
        expect(payload.memories).toHaveLength(1)
        expect(payload.diaries).toHaveLength(1)

        const before = await readActiveCounts(target.projectRoot)
        const dryRun = await runKonteks(target.projectRoot, [
            'memory',
            'import',
            exportPath,
            '--dry-run',
        ])
        expect(dryRun.output).toContain('diariesImported: 1')
        expect(dryRun.output).toContain('dryRun: true')
        expect(dryRun.output).toContain('memoriesImported: 1')
        expect(await readActiveCounts(target.projectRoot)).toEqual(before)

        const imported = await runKonteks(target.projectRoot, [
            'memory',
            'import',
            exportPath,
        ])
        expect(imported.output).toContain('diariesImported: 1')
        expect(imported.output).toContain('dryRun: false')
        expect(imported.output).toContain('memoriesImported: 1')
        expect(await readActiveCounts(target.projectRoot)).toEqual({
            diaries: 1,
            memories: 1,
        })
    }, 20000)
})

async function createInitializedProject(
    options: { seededMemory?: boolean } = {},
): Promise<{ projectRoot: string }> {
    return withFileBackedSqlite(async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-cli-e2e-'))
        tempDirs.push(projectRoot)

        await mkdir(projectRoot)
        await mkdir(join(projectRoot, '.git'))
        await mkdir(join(projectRoot, '.konteks'))
        await writeFile(join(projectRoot, 'README.md'), '# Fixture\n')

        const context = await withProjectRoot(projectRoot, () =>
            loadProjectContext(),
        )
        await writeProjectConfig(context, context.config)
        await withProjectRoot(projectRoot, () =>
            extractProject(context, 'full', {
                embeddingProvider: new FakeEmbeddingProvider(),
            }),
        )

        if (options.seededMemory) {
            await seedDurableMemory(projectRoot)
        }

        return { projectRoot }
    })
}

async function seedDurableMemory(projectRoot: string): Promise<void> {
    return withFileBackedSqlite(async () => {
        await withProjectRoot(projectRoot, async () => {
            await saveMemories({
                memories: [
                    {
                        content:
                            'CLI e2e durable memory should survive export and restore.',
                        importance: 3,
                        kind: 'note',
                    },
                ],
            })
            await saveDiary({
                subject: 'cli e2e fixture',
                summary:
                    'CLI e2e diary entries should survive export and restore.',
                tags: ['cli', 'e2e'],
            })
        })
    })
}

async function readActiveCounts(projectRoot: string): Promise<{
    diaries: number
    memories: number
}> {
    const outputPath = join(
        projectRoot,
        `.counts-${Math.random().toString(36).slice(2)}.json`,
    )
    const exported = await runKonteks(projectRoot, [
        'memory',
        'export',
        outputPath,
    ])
    expect(exported.exitCode).toBe(0)

    const payload = JSON.parse(
        await readFile(outputPath, 'utf8'),
    ) as DurableMemoryExport
    await rm(outputPath, { force: true })

    return {
        diaries: payload.diaries.length,
        memories: payload.memories.length,
    }
}

async function withFileBackedSqlite<T>(
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.env.KONTEKS_SQLITE_TEST_DATABASE
    process.env.KONTEKS_SQLITE_TEST_DATABASE = 'file'

    try {
        return await operation()
    } finally {
        if (previous === undefined) {
            delete process.env.KONTEKS_SQLITE_TEST_DATABASE
        } else {
            process.env.KONTEKS_SQLITE_TEST_DATABASE = previous
        }
    }
}

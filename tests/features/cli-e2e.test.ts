// @ts-nocheck
import { afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import InitCommand from '@/commands/init-command'
import type { DurableMemoryExport } from '@/models/memory-transfer'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import {
    saveKonteksDiary,
    saveKonteksMemory,
} from '@/providers/persistence/sqlite/save-konteks-input'
import { loadProjectContext } from '@/providers/project/context'
import FakeEmbeddingProvider from '@/support/fake/fake-embedding-provider'
import { VERSION } from '@/support/version'

const execFileAsync = promisify(execFile)
const tempDirs: string[] = []

beforeAll(async () => {
    if (await Bun.file(join(process.cwd(), 'dist', 'main.js')).exists()) {
        return
    }

    await execFileAsync('bun', ['run', 'build'], {
        cwd: process.cwd(),
        env: commandEnv(process.env.HOME ?? process.cwd()),
    })
})

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('cli/e2e', () => {
    it('reports already-initialized on a seeded project', async () => {
        const fixture = await createInitializedProject()

        const result = await runKonteks(fixture.projectRoot, ['init'])

        expect(result.exitCode).toBe(0)
        expect(result.output).toContain(`Konteks v${VERSION}`)
        expect(result.output).toContain('Konteks is already initialized at')
        expect(result.output).toContain('.konteks')
    }, 20000)

    it('prints status for initialized projects and reports changed files', async () => {
        const fixture = await createInitializedProject()

        const initial = await runKonteks(fixture.projectRoot, ['status'])
        expect(initial.exitCode).toBe(0)
        expect(initial.output).toContain('Konteks Memory')
        expect(initial.output).toContain(fixture.projectRoot)
        expect(initial.output).toContain(join(fixture.projectRoot, '.konteks'))
        expect(initial.output).toContain('no file changes')

        await writeFile(
            join(fixture.projectRoot, 'README.md'),
            '# Fixture\nChanged after init.\n',
        )

        const changed = await runKonteks(fixture.projectRoot, ['status'])
        expect(changed.exitCode).toBe(0)
        expect(changed.output).toContain('1 file changed')
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
        expect(
            parseJsonFromOutput<{ outputPath: string }>(backup.output),
        ).toEqual({
            outputPath: resolve(archivePath),
        })
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
        const restoreJson = parseJsonFromOutput<{
            inputPath: string
            memoryDir: string
            safetyBackupPath?: string
        }>(restored.output)
        expect(restored.exitCode).toBe(0)
        expect(restoreJson.inputPath).toBe(resolve(archivePath))
        expect(restoreJson.memoryDir).toBe(join(target.projectRoot, '.konteks'))
        expect(restoreJson.safetyBackupPath).toContain('.safety-')
        expect(
            await Bun.file(restoreJson.safetyBackupPath ?? '').exists(),
        ).toBe(true)

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
        const exportJson = parseJsonFromOutput<{
            diaries: number
            memories: number
            outputPath: string
        }>(exported.output)
        expect(exported.exitCode).toBe(0)
        expect(exportJson).toEqual({
            diaries: 1,
            memories: 1,
            outputPath: resolve(exportPath),
        })

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
        expect(
            parseJsonFromOutput<{
                diariesImported: number
                diariesSkipped: number
                dryRun: boolean
                memoriesImported: number
                memoriesSkipped: number
            }>(dryRun.output),
        ).toMatchObject({
            diariesImported: 1,
            dryRun: true,
            memoriesImported: 1,
        })
        expect(await readActiveCounts(target.projectRoot)).toEqual(before)

        const imported = await runKonteks(target.projectRoot, [
            'memory',
            'import',
            exportPath,
        ])
        expect(
            parseJsonFromOutput<{
                diariesImported: number
                dryRun: boolean
                memoriesImported: number
            }>(imported.output),
        ).toMatchObject({
            diariesImported: 1,
            dryRun: false,
            memoriesImported: 1,
        })
        expect(await readActiveCounts(target.projectRoot)).toEqual({
            diaries: 1,
            memories: 1,
        })
    }, 20000)

    it('renders MCP debug commands through the built CLI', async () => {
        const fixture = await createInitializedProject()

        const tools = await runKonteks(fixture.projectRoot, ['mcp', 'tools'])
        expect(tools.exitCode).toBe(0)
        expect(
            parseJsonFromOutput<Array<{ name: string }>>(tools.output).map(
                item => item.name,
            ),
        ).toEqual([
            'konteks_warm_up',
            'konteks_recall',
            'konteks_save_memories',
            'konteks_save_diary',
            'konteks_search',
            'konteks_forget',
        ])

        const tool = await runKonteks(fixture.projectRoot, [
            'mcp',
            'tool',
            'konteks_warm_up',
        ])
        expect(tool.exitCode).toBe(0)
        expect(parseJsonFromOutput<{ name: string }>(tool.output).name).toBe(
            'konteks_warm_up',
        )

        const prompts = await runKonteks(fixture.projectRoot, [
            'mcp',
            'prompts',
        ])
        expect(prompts.exitCode).toBe(0)
        expect(
            parseJsonFromOutput<Array<{ name: string }>>(prompts.output).map(
                item => item.name,
            ),
        ).toEqual(['konteks-recall', 'konteks-save', 'konteks-warm-up'])

        const prompt = await runKonteks(fixture.projectRoot, [
            'mcp',
            'prompt',
            'konteks-warm-up',
            'cli status command',
        ])
        expect(prompt.exitCode).toBe(0)
        expect(prompt.output).toContain('cli status command')
        expect(prompt.output).toContain('konteks_warm_up')
    }, 20000)

    it('supports read-only MCP calls and mutating save dry-run/apply semantics', async () => {
        const fixture = await createInitializedProject()

        const recall = await runKonteks(fixture.projectRoot, [
            'mcp',
            'call',
            'konteks_recall',
            '{"task":"project memory"}',
        ])
        expect(recall.exitCode).toBe(0)
        expect(recall.output).toContain('recall:')

        const warmUp = await runKonteks(fixture.projectRoot, [
            'mcp',
            'call',
            'konteks_warm_up',
            '{"maxTokens":200}',
        ])
        expect(warmUp.exitCode).toBe(0)
        expect(warmUp.output).toContain('warm_up:')

        const before = await readActiveCounts(fixture.projectRoot)

        const dryRunSave = await runKonteks(fixture.projectRoot, [
            'mcp',
            'call',
            'konteks_save_diary',
            '{"summary":"Dry run diary entry should not persist to project memory."}',
        ])
        expect(dryRunSave.exitCode).toBe(0)
        expect(dryRunSave.output).toContain('konteks: session diary saved')
        expect(await readActiveCounts(fixture.projectRoot)).toEqual(before)

        const dryRunMemories = await runKonteks(fixture.projectRoot, [
            'mcp',
            'call',
            'konteks_save_memories',
            '{"memories":[{"content":"Applied memory entry should persist to project memory.","importance":3,"kind":"note","type":"memory"}]}',
        ])
        expect(dryRunMemories.exitCode).toBe(0)
        expect(dryRunMemories.output).toContain(
            'konteks: durable memories saved',
        )
        expect(await readActiveCounts(fixture.projectRoot)).toEqual(before)

        const applySave = await runKonteks(fixture.projectRoot, [
            'mcp',
            'call',
            'konteks_save_diary',
            '--apply',
            '{"summary":"Applied diary entry should persist to project memory."}',
        ])
        expect(applySave.exitCode).toBe(0)
        expect(applySave.output).toContain('konteks: session diary saved')
        expect(await readActiveCounts(fixture.projectRoot)).toEqual({
            diaries: before.diaries + 1,
            memories: before.memories,
        })
    }, 20000)
})

async function createInitializedProject(
    options: { seededMemory?: boolean } = {},
): Promise<{ projectRoot: string }> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-cli-e2e-'))
    tempDirs.push(projectRoot)

    await mkdir(projectRoot, { recursive: true })
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await writeFile(join(projectRoot, 'README.md'), '# Fixture\n')

    await withProjectRoot(projectRoot, () =>
        new InitCommand().run({
            embeddingProvider: new FakeEmbeddingProvider(),
        }),
    )

    if (options.seededMemory) {
        await seedDurableMemory(projectRoot)
    }

    return { projectRoot }
}

async function seedDurableMemory(projectRoot: string): Promise<void> {
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const db = await openProjectDatabase(context)

    try {
        await saveKonteksMemory(db, context, {
            content:
                'CLI e2e durable memory should survive export and restore.',
            importance: 3,
            kind: 'note',
        })
        await saveKonteksDiary(db, context, {
            subject: 'cli e2e fixture',
            summary: 'CLI e2e diary entries should survive export and restore.',
            tags: ['cli', 'e2e'],
        })
    } finally {
        await db.close()
    }
}

async function readActiveCounts(projectRoot: string): Promise<{
    diaries: number
    memories: number
}> {
    const context = await withProjectRoot(projectRoot, () =>
        loadProjectContext(),
    )
    const db = await openProjectDatabase(context)

    try {
        const [memoryRows, diaryRows] = await Promise.all([
            db.adapter.query<{ count: number }>(
                'select count(*) as count from observations where deleted_at is null and suppressed_at is null',
            ),
            db.adapter.query<{ count: number }>(
                'select count(*) as count from diary_entries where deleted_at is null and suppressed_at is null',
            ),
        ])

        return {
            diaries: diaryRows[0]?.count ?? 0,
            memories: memoryRows[0]?.count ?? 0,
        }
    } finally {
        await db.close()
    }
}

async function runKonteks(
    projectRoot: string,
    args: string[],
): Promise<{
    exitCode: number | null
    output: string
}> {
    const homeDir = await mkdtemp(join(tmpdir(), 'konteks-cli-home-'))
    const ioDir = await mkdtemp(join(tmpdir(), 'konteks-cli-io-'))
    tempDirs.push(homeDir)
    tempDirs.push(ioDir)
    const stdoutPath = join(ioDir, 'stdout.txt')
    const stderrPath = join(ioDir, 'stderr.txt')
    const command = [
        'node',
        shellQuote(join(process.cwd(), 'dist', 'main.js')),
        ...args.map(shellQuote),
        '>',
        shellQuote(stdoutPath),
        '2>',
        shellQuote(stderrPath),
    ].join(' ')

    try {
        await execFileAsync('sh', ['-lc', command], {
            cwd: projectRoot,
            env: commandEnv(homeDir),
        })

        return {
            exitCode: 0,
            output: await readOutput(stdoutPath, stderrPath),
        }
    } catch (error) {
        const failure = error as {
            code?: number
        }

        return {
            exitCode: typeof failure.code === 'number' ? failure.code : null,
            output: await readOutput(stdoutPath, stderrPath),
        }
    }
}

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

function parseJsonFromOutput<T>(output: string): T {
    const objectIndex = output.indexOf('{')
    const arrayIndex = output.indexOf('[')
    const startCandidates = [objectIndex, arrayIndex].filter(
        index => index >= 0,
    )

    if (startCandidates.length === 0) {
        throw new Error(`Expected JSON output, got:\n${output}`)
    }

    const start = Math.min(...startCandidates)
    return JSON.parse(output.slice(start)) as T
}

function commandEnv(homeDir: string): Record<string, string> {
    return {
        ...Object.fromEntries(
            Object.entries(process.env).filter(
                (entry): entry is [string, string] =>
                    typeof entry[1] === 'string',
            ),
        ),
        HOME: homeDir,
        KONTEKS_MODEL_CACHE_DIR: join(homeDir, '.cache', 'konteks', 'models'),
        NO_COLOR: '1',
    }
}

function shellQuote(value: string): string {
    return `'${value.replaceAll("'", "'\"'\"'")}'`
}

async function readOutput(
    stdoutPath: string,
    stderrPath: string,
): Promise<string> {
    const [stdout, stderr] = await Promise.all([
        readFile(stdoutPath, 'utf8').catch(() => ''),
        readFile(stderrPath, 'utf8').catch(() => ''),
    ])

    return `${stdout}\n${stderr}`.trim()
}

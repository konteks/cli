import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
    cp,
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import type {
    DurableMemoryExport,
    DurableMemoryExportOptions,
    DurableMemoryExportResult,
    DurableMemoryImportOptions,
    DurableMemoryImportResult,
    MemoryBackupOptions,
    MemoryBackupResult,
    MemoryRestoreOptions,
    MemoryRestoreResult,
} from '@/models/memory-transfer'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import {
    exportDurableMemory,
    importDurableMemory,
} from '@/providers/persistence/sqlite/memory-transfer-store'
import { loadProjectContext, pathExists } from '@/providers/project/context'
import { CliUserError } from '@/support/cli/errors'

const execFileAsync = promisify(execFile)

export async function exportMemory(
    options: DurableMemoryExportOptions,
): Promise<DurableMemoryExportResult> {
    const context = await loadProjectContext(options.project)
    const service = await openProjectDatabase(context)
    try {
        const payload = await exportDurableMemory(service, context, {
            includeInactive: options.includeInactive,
        })
        payload.project.name = basename(context.projectRoot)
        await mkdir(dirname(resolve(options.outputPath)), { recursive: true })
        await writeFile(
            options.outputPath,
            `${JSON.stringify(payload, null, 2)}\n`,
        )
        return {
            diaries: payload.diaries.length,
            memories: payload.memories.length,
            outputPath: resolve(options.outputPath),
        }
    } finally {
        await service.close()
    }
}

export async function importMemory(
    options: DurableMemoryImportOptions,
): Promise<DurableMemoryImportResult> {
    const context = await loadProjectContext(options.project)
    const payload = parseDurableMemoryExport(
        await readFile(options.inputPath, 'utf8'),
    )
    const service = await openProjectDatabase(context)
    try {
        return await importDurableMemory(service, context, payload, {
            dryRun: options.dryRun,
        })
    } finally {
        await service.close()
    }
}

export async function backupMemory(
    options: MemoryBackupOptions,
): Promise<MemoryBackupResult> {
    const context = await loadProjectContext(options.project)
    if (!(await pathExists(context.memoryDir))) {
        throw new CliUserError({
            command: 'konteks init',
            message: 'No Konteks memory directory exists for this project.',
            title: 'Cannot create backup',
        })
    }

    const outputPath = resolve(options.outputPath)
    await mkdir(dirname(outputPath), { recursive: true })
    await createTarGz(context.memoryDir, outputPath)
    return { outputPath }
}

export async function restoreMemory(
    options: MemoryRestoreOptions,
): Promise<MemoryRestoreResult> {
    const context = await loadProjectContext(options.project)
    const inputPath = resolve(options.inputPath)
    const memoryDirExists = await pathExists(context.memoryDir)
    const targetHasFiles =
        memoryDirExists && (await readdir(context.memoryDir)).length > 0

    if (targetHasFiles && !options.force) {
        throw new CliUserError({
            command: `konteks restore ${inputPath} --force`,
            message:
                'The target memory directory is not empty. Restore would replace existing memory.',
            title: 'Restore refused',
        })
    }

    const safetyBackupPath =
        targetHasFiles && options.force
            ? await createSafetyBackup(context.memoryDir, inputPath)
            : undefined
    const tempDir = await mkdtemp(join(dirname(context.memoryDir), '.restore-'))
    try {
        await extractTarGz(inputPath, tempDir)
        await rm(context.memoryDir, { force: true, recursive: true })
        await mkdir(dirname(context.memoryDir), { recursive: true })
        await cp(tempDir, context.memoryDir, { recursive: true })
    } finally {
        await rm(tempDir, { force: true, recursive: true })
    }

    return {
        inputPath,
        memoryDir: context.memoryDir,
        safetyBackupPath,
    }
}

function parseDurableMemoryExport(raw: string): DurableMemoryExport {
    const parsed = JSON.parse(raw) as Partial<DurableMemoryExport>
    if (parsed.format !== 'konteks.durable-memory.v1') {
        throw new CliUserError({
            message: 'Expected format "konteks.durable-memory.v1".',
            title: 'Unsupported memory export',
        })
    }
    if (!Array.isArray(parsed.memories) || !Array.isArray(parsed.diaries)) {
        throw new CliUserError({
            message: 'The memory export is missing memories or diaries arrays.',
            title: 'Invalid memory export',
        })
    }
    return parsed as DurableMemoryExport
}

async function createSafetyBackup(
    memoryDir: string,
    inputPath: string,
): Promise<string> {
    const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, '-')
    const safetyBackupPath = `${inputPath}.${timestamp}.safety-${randomUUID().slice(0, 8)}.tar.gz`
    await createTarGz(memoryDir, safetyBackupPath)
    return safetyBackupPath
}

async function createTarGz(
    sourceDir: string,
    outputPath: string,
): Promise<void> {
    await runTar(['-czf', outputPath, '-C', sourceDir, '.'])
}

async function extractTarGz(
    inputPath: string,
    outputDir: string,
): Promise<void> {
    await runTar(['-xzf', inputPath, '-C', outputDir])
}

async function runTar(args: string[]): Promise<void> {
    try {
        await execFileAsync('tar', args)
    } catch (error) {
        throw new CliUserError({
            message:
                error instanceof Error
                    ? error.message
                    : 'Unable to execute the tar command.',
            title: 'Archive operation failed',
        })
    }
}

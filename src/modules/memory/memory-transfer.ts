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
import {
    exportProjectDurableMemory,
    importProjectDurableMemory,
} from '@/database/services/memory-transfer'
import { loadProjectContext, pathExists } from '@/modules/project/context'
import CliUserError from '@/support/cli/cli-user-error'
import { createTarGz, extractTarGz } from '@/support/targz'
import type {
    DurableMemoryExport,
    DurableMemoryExportOptions,
    DurableMemoryExportResult,
    DurableMemoryImportOptions,
    DurableMemoryImportResult,
    MemoryRestoreOptions,
    MemoryRestoreResult,
} from '@/types/memory-transfer'

export async function exportMemory(
    options: DurableMemoryExportOptions,
): Promise<DurableMemoryExportResult> {
    const context = await loadProjectContext()
    const payload = await exportProjectDurableMemory(context, {
        includeInactive: options.includeInactive,
    })
    payload.project.name = basename(context.projectRoot)
    await mkdir(dirname(resolve(options.outputPath)), { recursive: true })
    await writeFile(options.outputPath, `${JSON.stringify(payload, null, 2)}\n`)
    return {
        diaries: payload.diaries.length,
        memories: payload.memories.length,
        outputPath: resolve(options.outputPath),
    }
}

export async function importMemory(
    options: DurableMemoryImportOptions,
): Promise<DurableMemoryImportResult> {
    const context = await loadProjectContext()
    const payload = parseDurableMemoryExport(
        await readFile(options.inputPath, 'utf8'),
    )
    return await importProjectDurableMemory(context, payload, {
        dryRun: options.dryRun,
    })
}

export async function restoreMemory(
    options: MemoryRestoreOptions,
): Promise<MemoryRestoreResult> {
    const context = await loadProjectContext()
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

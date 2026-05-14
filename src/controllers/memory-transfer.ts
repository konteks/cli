import {
    backupMemory,
    exportMemory,
    importMemory,
    restoreMemory,
} from '@/composition/memory-transfer'
import type { GlobalCliOptions } from '@/models/cli'
import { stringifyPretty } from '@/support/json/io'
import { terminal } from '@/support/terminal/service'

type MemoryExportOptions = GlobalCliOptions & {
    includeInactive?: boolean
}

type MemoryImportOptions = GlobalCliOptions & {
    dryRun?: boolean
}

type RestoreOptions = GlobalCliOptions & {
    force?: boolean
}

export async function exportMemoryCommand(
    options: MemoryExportOptions,
    outputPath: string,
): Promise<void> {
    terminal.log(
        stringifyPretty(
            await exportMemory({
                includeInactive: options.includeInactive,
                outputPath,
                project: options.project,
            }),
        ),
    )
}

export async function importMemoryCommand(
    options: MemoryImportOptions,
    inputPath: string,
): Promise<void> {
    terminal.log(
        stringifyPretty(
            await importMemory({
                dryRun: options.dryRun,
                inputPath,
                project: options.project,
            }),
        ),
    )
}

export async function backupMemoryCommand(
    options: GlobalCliOptions,
    outputPath: string,
): Promise<void> {
    terminal.log(
        stringifyPretty(
            await backupMemory({
                outputPath,
                project: options.project,
            }),
        ),
    )
}

export async function restoreMemoryCommand(
    options: RestoreOptions,
    inputPath: string,
): Promise<void> {
    terminal.log(
        stringifyPretty(
            await restoreMemory({
                force: options.force,
                inputPath,
                project: options.project,
            }),
        ),
    )
}

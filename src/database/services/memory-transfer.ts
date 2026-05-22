import type {
    DurableMemoryExport,
    DurableMemoryExportOptions,
    DurableMemoryImportOptions,
    DurableMemoryImportResult,
} from '@/types/memory-transfer'
import type { Project } from '@/types/project'
import exportDurableMemory from './export-durable-memory'
import importDurableMemory from './import-durable-memory'

export async function exportProjectDurableMemory(
    context: Project,
    options: Pick<DurableMemoryExportOptions, 'includeInactive'> = {},
): Promise<DurableMemoryExport> {
    return await exportDurableMemory(context, {
        includeInactive: options.includeInactive,
    })
}

export async function importProjectDurableMemory(
    context: Project,
    payload: DurableMemoryExport,
    options: Pick<DurableMemoryImportOptions, 'dryRun'> = {},
): Promise<DurableMemoryImportResult> {
    return await importDurableMemory(context, payload, {
        dryRun: options.dryRun,
    })
}

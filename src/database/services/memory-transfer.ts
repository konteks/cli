import { openProjectDatabase } from '@/database/actions/_db'
import type {
    DurableMemoryExport,
    DurableMemoryExportOptions,
    DurableMemoryImportOptions,
    DurableMemoryImportResult,
} from '@/models/memory-transfer'
import type { Project } from '@/models/project'
import exportDurableMemory from './export-durable-memory'
import importDurableMemory from './import-durable-memory'

export async function exportProjectDurableMemory(
    context: Project,
    options: Pick<DurableMemoryExportOptions, 'includeInactive'> = {},
): Promise<DurableMemoryExport> {
    const connection = await openProjectDatabase(context)
    try {
        return await exportDurableMemory(connection, context, {
            includeInactive: options.includeInactive,
        })
    } finally {
        await connection.close()
    }
}

export async function importProjectDurableMemory(
    context: Project,
    payload: DurableMemoryExport,
    options: Pick<DurableMemoryImportOptions, 'dryRun'> = {},
): Promise<DurableMemoryImportResult> {
    const connection = await openProjectDatabase(context)
    try {
        return await importDurableMemory(connection, context, payload, {
            dryRun: options.dryRun,
        })
    } finally {
        await connection.close()
    }
}

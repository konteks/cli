import type { SqliteConnection } from '@/database/actions/_db'
import queryExportDiaryRows from '@/database/actions/query-export-diary-rows'
import queryExportObservationRows from '@/database/actions/query-export-observation-rows'
import withBoundActionDatabase from '@/database/actions/with-bound-action-database'
import {
    exportDiaryRow,
    exportObservationRow,
} from '@/database/support/memory-transfer'
import type { DurableMemoryExport } from '@/models/memory-transfer'
import type { Project } from '@/models/project'
import createToonStore from '@/providers/persistence/objects/create-toon-store'

export default async function exportDurableMemory(
    db: SqliteConnection,
    context: Project,
    options: { includeInactive?: boolean },
): Promise<DurableMemoryExport> {
    const toonStore = createToonStore(context.memoryDir)
    const { diaryRows, memoryRows } = await withBoundActionDatabase(
        db,
        async () => ({
            diaryRows: await queryExportDiaryRows(options),
            memoryRows: await queryExportObservationRows(options),
        }),
    )

    return {
        diaries: await Promise.all(
            diaryRows.map(row => exportDiaryRow(row, toonStore)),
        ),
        exportedAt: new Date().toISOString(),
        format: 'konteks.durable-memory.v1',
        memories: await Promise.all(
            memoryRows.map(row => exportObservationRow(row, toonStore)),
        ),
        project: {
            root: context.projectRoot,
        },
    }
}

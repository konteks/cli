import type { DurableMemoryExport } from '@/models/memory-transfer'
import type { Project } from '@/models/project'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import type DatabaseService from './database-service'
import {
    exportDiaryRow,
    exportObservationRow,
} from './durable-memory-export-mappers'
import type {
    DiaryExportRow,
    ObservationExportRow,
} from './durable-memory-transfer-types'

export default async function exportDurableMemory(
    db: DatabaseService,
    context: Project,
    options: { includeInactive?: boolean },
): Promise<DurableMemoryExport> {
    const toonStore = createToonStore(context.memoryDir)
    const activeFilter = options.includeInactive
        ? ''
        : 'where deleted_at is null and suppressed_at is null'
    const memoryRows = await db.adapter.query<ObservationExportRow>(
        `
select id, kind, text_inline, payload_ref, content_hash, confidence, created_at, deleted_at, suppressed_at, forget_reason
from observations
${activeFilter}
order by created_at asc
`,
    )
    const diaryRows = await db.adapter.query<DiaryExportRow>(
        `
select id, subject, summary, tags_json, payload_ref, content_hash, deleted_at, suppressed_at, forget_reason, created_at
from diary_entries
${activeFilter}
order by created_at asc
`,
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

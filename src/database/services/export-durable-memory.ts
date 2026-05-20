import type { SqliteConnection } from '@/database/actions/_db'
import { querySql } from '@/database/support/libsql'
import {
    exportDiaryRow,
    exportObservationRow,
} from '@/database/support/memory-transfer'
import type {
    DiaryExportRow,
    ObservationExportRow,
} from '@/database/support/memory-transfer-types'
import type { DurableMemoryExport } from '@/models/memory-transfer'
import type { Project } from '@/models/project'
import createToonStore from '@/providers/persistence/objects/create-toon-store'

export default async function exportDurableMemory(
    db: SqliteConnection,
    context: Project,
    options: { includeInactive?: boolean },
): Promise<DurableMemoryExport> {
    const toonStore = createToonStore(context.memoryDir)
    const activeFilter = options.includeInactive
        ? ''
        : 'where deleted_at is null and suppressed_at is null'
    const memoryRows = await querySql<ObservationExportRow>(
        db.client,
        `
select id, kind, text_inline, payload_ref, content_hash, confidence, created_at, deleted_at, suppressed_at, forget_reason
from observations
${activeFilter}
order by created_at asc
`,
    )
    const diaryRows = await querySql<DiaryExportRow>(
        db.client,
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

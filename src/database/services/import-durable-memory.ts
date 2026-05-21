import { randomUUID } from 'node:crypto'
import { withTransaction } from '@/database/actions/_db'
import appendMemoryEvent from '@/database/actions/append-memory-event'
import hasDiaryHash from '@/database/actions/has-diary-hash'
import hasObservationHash from '@/database/actions/has-observation-hash'
import type {
    DurableMemoryExport,
    DurableMemoryImportResult,
} from '@/models/memory-transfer'
import type { Project } from '@/models/project'
import {
    insertImportedDiary,
    insertImportedObservation,
} from './durable-memory-import-writers'

export default async function importDurableMemory(
    context: Project,
    payload: DurableMemoryExport,
    options: { dryRun?: boolean },
): Promise<DurableMemoryImportResult> {
    const result: DurableMemoryImportResult = {
        diariesImported: 0,
        diariesSkipped: 0,
        dryRun: Boolean(options.dryRun),
        memoriesImported: 0,
        memoriesSkipped: 0,
    }

    await withTransaction(async () => {
        for (const memory of payload.memories) {
            const duplicate = await hasObservationHash(memory.contentHash)
            if (duplicate) {
                result.memoriesSkipped += 1
                continue
            }
            if (!options.dryRun) {
                await insertImportedObservation(context, memory)
            }
            result.memoriesImported += 1
        }

        for (const diary of payload.diaries) {
            const duplicate = await hasDiaryHash(diary.contentHash)
            if (duplicate) {
                result.diariesSkipped += 1
                continue
            }
            if (!options.dryRun) {
                await insertImportedDiary(context, diary)
            }
            result.diariesImported += 1
        }
    })

    if (!options.dryRun) {
        await withTransaction(async () =>
            appendMemoryEvent({
                actor: 'cli',
                eventType: 'memory_imported',
                id: `event_${randomUUID()}`,
                subjectType: 'memory_import',
                summary: `Imported ${result.memoriesImported} memories and ${result.diariesImported} diary entries; skipped ${result.memoriesSkipped + result.diariesSkipped} duplicates.`,
            }),
        )
    }

    return result
}

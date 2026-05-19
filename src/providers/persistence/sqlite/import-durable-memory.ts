import { randomUUID } from 'node:crypto'
import type {
    DurableMemoryExport,
    DurableMemoryImportResult,
} from '@/models/memory-transfer'
import type { Project } from '@/models/project'
import type DatabaseService from './database-service'
import {
    insertImportedDiary,
    insertImportedObservation,
} from './durable-memory-import-writers'
import { querySql } from './libsql-helpers'

export default async function importDurableMemory(
    db: DatabaseService,
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

    for (const memory of payload.memories) {
        const duplicate = await hasObservationHash(db, memory.contentHash)
        if (duplicate) {
            result.memoriesSkipped += 1
            continue
        }
        if (!options.dryRun) {
            await insertImportedObservation(db, context, memory)
        }
        result.memoriesImported += 1
    }

    for (const diary of payload.diaries) {
        const duplicate = await hasDiaryHash(db, diary.contentHash)
        if (duplicate) {
            result.diariesSkipped += 1
            continue
        }
        if (!options.dryRun) {
            await insertImportedDiary(db, context, diary)
        }
        result.diariesImported += 1
    }

    if (!options.dryRun) {
        await db.events.append({
            actor: 'cli',
            eventType: 'memory_imported',
            id: `event_${randomUUID()}`,
            subjectType: 'memory_import',
            summary: `Imported ${result.memoriesImported} memories and ${result.diariesImported} diary entries; skipped ${result.memoriesSkipped + result.diariesSkipped} duplicates.`,
        })
    }

    return result
}

async function hasObservationHash(
    db: DatabaseService,
    hash: string,
): Promise<boolean> {
    const rows = await querySql<{ id: string }>(
        db.client,
        `
select id
from observations
where content_hash = ?
limit 1
`,
        [hash],
    )
    return rows.length > 0
}

async function hasDiaryHash(
    db: DatabaseService,
    hash: string,
): Promise<boolean> {
    const rows = await querySql<{ id: string }>(
        db.client,
        `
select id
from diary_entries
where content_hash = ?
limit 1
`,
        [hash],
    )
    return rows.length > 0
}

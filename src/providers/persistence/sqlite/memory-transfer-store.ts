import { randomUUID } from 'node:crypto'
import type {
    DurableMemoryExport,
    DurableMemoryExportDiary,
    DurableMemoryExportMemory,
    DurableMemoryImportResult,
} from '@/models/memory-transfer'
import type { Project } from '@/models/project'
import { contentHash } from '@/providers/persistence/objects/content'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import storePayload from '@/providers/persistence/objects/store-payload'
import { upsertRetrievalDocument } from '@/providers/persistence/sqlite/retrieval-documents'
import { indexSearchDocument } from '@/providers/persistence/sqlite/search-index'
import type DatabaseService from './database-service'

type ObservationExportRow = {
    confidence: number
    content_hash: string | null
    created_at: string
    deleted_at: string | null
    forget_reason: string | null
    id: string
    kind: DurableMemoryExportMemory['kind']
    payload_ref: string | null
    suppressed_at: string | null
    text_inline: string | null
}

type DiaryExportRow = {
    content_hash: string | null
    created_at: string
    deleted_at: string | null
    forget_reason: string | null
    id: string
    payload_ref: string | null
    subject: string | null
    summary: string
    suppressed_at: string | null
    tags_json: string | null
}

export async function exportDurableMemory(
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

export async function importDurableMemory(
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

async function exportObservationRow(
    row: ObservationExportRow,
    toonStore: ReturnType<typeof createToonStore>,
): Promise<DurableMemoryExportMemory> {
    const content = await resolveContent(
        row.text_inline,
        row.payload_ref,
        toonStore,
    )
    return {
        confidence: row.confidence,
        content,
        contentHash: row.content_hash ?? contentHash(content),
        createdAt: row.created_at,
        deletedAt: row.deleted_at ?? undefined,
        forgetReason: row.forget_reason ?? undefined,
        id: row.id,
        kind: row.kind,
        suppressedAt: row.suppressed_at ?? undefined,
    }
}

async function exportDiaryRow(
    row: DiaryExportRow,
    toonStore: ReturnType<typeof createToonStore>,
): Promise<DurableMemoryExportDiary> {
    const text = await resolveContent(row.summary, row.payload_ref, toonStore)
    const tags = parseTags(row.tags_json)
    const hashSource = [row.subject, row.summary, tags.join(', ')]
        .filter(Boolean)
        .join('\n')
    return {
        contentHash: row.content_hash ?? contentHash(hashSource || text),
        createdAt: row.created_at,
        deletedAt: row.deleted_at ?? undefined,
        forgetReason: row.forget_reason ?? undefined,
        id: row.id,
        subject: row.subject ?? undefined,
        summary: row.summary,
        suppressedAt: row.suppressed_at ?? undefined,
        tags,
    }
}

async function insertImportedObservation(
    db: DatabaseService,
    context: Project,
    memory: DurableMemoryExportMemory,
): Promise<void> {
    const id = `obs_${randomUUID()}`
    const stored = await storePayload(memory.content, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const createdAt = memory.createdAt || new Date().toISOString()

    await db.transaction(async tx => {
        await tx.adapter.execute(
            `
insert into observations (
    id, kind, text_inline, payload_ref, content_hash, confidence, created_at, deleted_at, suppressed_at, forget_reason
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                id,
                memory.kind,
                stored.contentInline ?? memory.content.slice(0, 240),
                stored.payloadRef ?? null,
                stored.contentHash,
                memory.confidence,
                createdAt,
                memory.deletedAt ?? null,
                memory.suppressedAt ?? null,
                memory.forgetReason ?? null,
            ],
        )
        await indexSearchDocument(tx.adapter, {
            content: memory.content,
            createdAt,
            id,
            kind: memory.kind,
            type: 'memory',
        })
        await upsertRetrievalDocument(tx, {
            anchor: id,
            embeddingText: memory.content,
            ftsText: memory.content,
            path: 'memory',
            sourceRole: 'unknown',
            summary: memory.content.slice(0, 240),
            targetId: id,
            targetType: 'memory',
            updatedAt: createdAt,
        })
    })
}

async function insertImportedDiary(
    db: DatabaseService,
    context: Project,
    diary: DurableMemoryExportDiary,
): Promise<void> {
    const id = `diary_${randomUUID()}`
    const text = [diary.subject, diary.summary, diary.tags.join(', ')]
        .filter(Boolean)
        .join('\n')
    const stored = await storePayload(text, {
        inlineMaxBytes: context.config.storage.inlinePayloadMaxBytes,
        toonStore: createToonStore(context.memoryDir),
    })
    const createdAt = diary.createdAt || new Date().toISOString()

    await db.transaction(async tx => {
        await tx.adapter.execute(
            `
insert into diary_entries (
    id, subject, summary, tags_json, payload_ref, content_hash, deleted_at, suppressed_at, forget_reason, created_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                id,
                diary.subject ?? null,
                diary.summary,
                JSON.stringify(diary.tags),
                stored.payloadRef ?? null,
                stored.contentHash,
                diary.deletedAt ?? null,
                diary.suppressedAt ?? null,
                diary.forgetReason ?? null,
                createdAt,
            ],
        )
        await indexSearchDocument(tx.adapter, {
            content: text,
            createdAt,
            id,
            kind: 'diary',
            type: 'diary',
        })
        await upsertRetrievalDocument(tx, {
            anchor: diary.subject ?? id,
            embeddingText: text,
            ftsText: text,
            path: 'diary',
            sourceRole: 'unknown',
            summary: diary.summary,
            targetId: id,
            targetType: 'diary',
            updatedAt: createdAt,
        })
    })
}

async function hasObservationHash(
    db: DatabaseService,
    hash: string,
): Promise<boolean> {
    const rows = await db.adapter.query<{ id: string }>(
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
    const rows = await db.adapter.query<{ id: string }>(
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

async function resolveContent(
    inline: string | null,
    payloadRef: string | null,
    toonStore: ReturnType<typeof createToonStore>,
): Promise<string> {
    if (payloadRef) {
        return await toonStore.read(payloadRef)
    }
    return inline ?? ''
}

function parseTags(raw: string | null): string[] {
    if (!raw) {
        return []
    }
    try {
        const parsed = JSON.parse(raw) as unknown
        return Array.isArray(parsed)
            ? parsed.filter(value => typeof value === 'string')
            : []
    } catch {
        return []
    }
}

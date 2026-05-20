import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { ForgetInput } from '@/contracts/repositories/memory-repository'
import { type SqliteConnection, withTransaction } from '@/database/actions/_db'
import appendMemoryEvent from '@/database/actions/append-memory-event'
import queryDiaries from '@/database/actions/query-diaries'
import queryObservations from '@/database/actions/query-observations'
import {
    chunks,
    diaryEntries,
    memoryFts,
    memoryFtsIndexed,
    observations,
    taxonomyLinks,
} from '@/database/schema'
import { invalidateRelation } from '@/database/services/graph'

// import { GraphStore } from ./graph-store.js'

type ForgetResult = {
    accepted: boolean
    mode: NonNullable<ForgetInput['mode']>
    affectedIds: string[]
}

type TargetKind = 'chunk' | 'diary_entry' | 'observation' | 'relation'

type ForgetTarget = {
    id: string
    kind: TargetKind
}

export default async function forgetMemory(
    db: SqliteConnection,
    input: ForgetInput,
): Promise<ForgetResult> {
    const mode = input.mode ?? 'soft_delete'
    const targets = await resolveTargets(input)
    const affectedIds: string[] = []

    await withTransaction(db, async tx => {
        for (const target of targets) {
            const changed = await applyForget(tx, target, mode, input.reason)
            if (!changed) {
                continue
            }

            await removeFromSearchIndex(tx, target.id)

            await appendMemoryEvent({
                actor: 'mcp',
                eventType: `memory_${mode}`,
                id: `event_${randomUUID()}`,
                subjectId: target.id,
                subjectType: target.kind,
                summary: input.reason ?? `Applied ${mode} to ${target.id}.`,
            })
            affectedIds.push(target.id)
        }
    })

    return {
        accepted: affectedIds.length > 0,
        affectedIds,
        mode,
    }
}

async function resolveTargets(input: ForgetInput): Promise<ForgetTarget[]> {
    if (input.id) {
        return [{ id: input.id, kind: inferKind(input.id) }]
    }

    if (!input.query) {
        return []
    }

    const terms = tokenize(input.query)
    if (terms.length === 0) {
        return []
    }

    const [observations, diaries] = await Promise.all([
        queryObservations(terms, 10),
        queryDiaries(terms, 10),
    ])

    return [
        ...observations.map(row => ({
            id: row.id,
            kind: 'observation' as const,
        })),
        ...diaries.map(row => ({
            id: row.id,
            kind: 'diary_entry' as const,
        })),
    ].slice(0, 10)
}

async function applyForget(
    db: SqliteConnection,
    target: ForgetTarget,
    mode: NonNullable<ForgetInput['mode']>,
    reason: string | undefined,
): Promise<boolean> {
    if (target.kind === 'relation') {
        await invalidateRelation(target.id)
        return true
    }

    if (mode === 'invalidate') {
        return markSuppressed(db, target, reason)
    }

    if (mode === 'hard_delete') {
        return hardDelete(db, target)
    }

    return markForgotten(db, target, reason)
}

async function markForgotten(
    db: SqliteConnection,
    target: ForgetTarget,
    reason: string | undefined,
): Promise<boolean> {
    const values = {
        deletedAt: new Date().toISOString(),
        forgetReason: reason ?? null,
    }
    if (target.kind === 'chunk') {
        await db.db.update(chunks).set(values).where(eq(chunks.id, target.id))
    } else if (target.kind === 'observation') {
        await db.db
            .update(observations)
            .set(values)
            .where(eq(observations.id, target.id))
    } else if (target.kind === 'diary_entry') {
        await db.db
            .update(diaryEntries)
            .set(values)
            .where(eq(diaryEntries.id, target.id))
    } else {
        return false
    }
    return true
}

async function markSuppressed(
    db: SqliteConnection,
    target: ForgetTarget,
    reason: string | undefined,
): Promise<boolean> {
    const values = {
        forgetReason: reason ?? null,
        suppressedAt: new Date().toISOString(),
    }
    if (target.kind === 'chunk') {
        await db.db.update(chunks).set(values).where(eq(chunks.id, target.id))
    } else if (target.kind === 'observation') {
        await db.db
            .update(observations)
            .set(values)
            .where(eq(observations.id, target.id))
    } else if (target.kind === 'diary_entry') {
        await db.db
            .update(diaryEntries)
            .set(values)
            .where(eq(diaryEntries.id, target.id))
    } else {
        return false
    }
    return true
}

async function hardDelete(
    db: SqliteConnection,
    target: ForgetTarget,
): Promise<boolean> {
    if (target.kind === 'chunk') {
        await db.db
            .delete(taxonomyLinks)
            .where(eq(taxonomyLinks.targetId, target.id))
    }

    if (target.kind === 'chunk') {
        await db.db.delete(chunks).where(eq(chunks.id, target.id))
    } else if (target.kind === 'observation') {
        await db.db.delete(observations).where(eq(observations.id, target.id))
    } else if (target.kind === 'diary_entry') {
        await db.db.delete(diaryEntries).where(eq(diaryEntries.id, target.id))
    } else {
        return false
    }
    return true
}

async function removeFromSearchIndex(
    db: SqliteConnection,
    id: string,
): Promise<void> {
    await db.db.delete(memoryFts).where(eq(memoryFts.id, id))
    await db.db.delete(memoryFtsIndexed).where(eq(memoryFtsIndexed.id, id))
}

function inferKind(id: string): TargetKind {
    if (id.startsWith('chunk_')) {
        return 'chunk'
    }
    if (id.startsWith('diary_')) {
        return 'diary_entry'
    }
    if (id.startsWith('rel_')) {
        return 'relation'
    }

    return 'observation'
}

function tokenize(query: string): string[] {
    return [
        ...new Set(
            query
                .toLowerCase()
                .split(/[^a-z0-9_/-]+/u)
                .map(term => term.trim())
                .filter(term => term.length >= 2),
        ),
    ].slice(0, 8)
}

import { randomUUID } from 'node:crypto'
import { type SqliteConnection, withTransaction } from '@/database/actions/_db'
import appendMemoryEvent from '@/database/actions/append-memory-event'
import hardDeleteForgetTarget from '@/database/actions/hard-delete-forget-target'
import markForgotten from '@/database/actions/mark-forgotten'
import markSuppressed from '@/database/actions/mark-suppressed'
import queryDiaries from '@/database/actions/query-diaries'
import queryObservations from '@/database/actions/query-observations'
import removeFromSearchIndex from '@/database/actions/remove-from-search-index'
import { invalidateRelation } from '@/database/services/graph'
import type {
    ForgetResult,
    ForgetTarget,
    TargetKind,
} from '@/database/support/forget-target'

export type ForgetInput = {
    id?: string
    query?: string
    mode?: 'hard_delete' | 'invalidate' | 'soft_delete'
    reason?: string
}

export default async function forgetMemory(
    db: SqliteConnection,
    input: ForgetInput,
): Promise<ForgetResult> {
    const mode = input.mode ?? 'soft_delete'
    const targets = await resolveTargets(input)
    const affectedIds: string[] = []

    await withTransaction(db, async () => {
        for (const target of targets) {
            const changed = await applyForget(target, mode, input.reason)
            if (!changed) {
                continue
            }

            await removeFromSearchIndex(target.id)

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
    target: ForgetTarget,
    mode: NonNullable<ForgetInput['mode']>,
    reason: string | undefined,
): Promise<boolean> {
    if (target.kind === 'relation') {
        await invalidateRelation(target.id)
        return true
    }

    if (mode === 'invalidate') {
        return markSuppressed(target, reason)
    }

    if (mode === 'hard_delete') {
        return hardDeleteForgetTarget(target)
    }

    return markForgotten(target, reason)
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

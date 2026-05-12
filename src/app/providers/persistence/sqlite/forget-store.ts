import { randomUUID } from 'node:crypto'
import type { ForgetInput } from '@/app/contracts/repositories/memory-repository'
import type { DatabaseService } from './db'
// import { GraphStore } from ./graph-store.js'
import { queryDiaries, queryObservations } from './persistence-adapter'

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

export async function forgetMemory(
    db: DatabaseService,
    input: ForgetInput,
): Promise<ForgetResult> {
    const mode = input.mode ?? 'soft_delete'
    const targets = await resolveTargets(db, input)
    const affectedIds: string[] = []

    await db.transaction(async tx => {
        for (const target of targets) {
            const changed = await applyForget(tx, target, mode, input.reason)
            if (!changed) {
                continue
            }

            await removeFromSearchIndex(tx, target.id)

            await tx.events.append({
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

async function resolveTargets(
    db: DatabaseService,
    input: ForgetInput,
): Promise<ForgetTarget[]> {
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
        queryObservations(db.adapter, terms, 10),
        queryDiaries(db.adapter, terms, 10),
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
    db: DatabaseService,
    target: ForgetTarget,
    mode: NonNullable<ForgetInput['mode']>,
    reason: string | undefined,
): Promise<boolean> {
    if (target.kind === 'relation') {
        await db.graph.invalidateRelation(target.id)
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
    db: DatabaseService,
    target: ForgetTarget,
    reason: string | undefined,
): Promise<boolean> {
    const table = tableForKind(target.kind)
    if (!table) {
        return false
    }

    await db.adapter.execute(
        `
update ${table}
set deleted_at = ?, forget_reason = ?
where id = ?
`,
        [new Date().toISOString(), reason ?? null, target.id],
    )
    return true
}

async function markSuppressed(
    db: DatabaseService,
    target: ForgetTarget,
    reason: string | undefined,
): Promise<boolean> {
    const table = tableForKind(target.kind)
    if (!table) {
        return false
    }

    await db.adapter.execute(
        `
update ${table}
set suppressed_at = ?, forget_reason = ?
where id = ?
`,
        [new Date().toISOString(), reason ?? null, target.id],
    )
    return true
}

async function hardDelete(
    db: DatabaseService,
    target: ForgetTarget,
): Promise<boolean> {
    if (target.kind === 'chunk') {
        await db.adapter.execute(
            'delete from taxonomy_links where target_id = ?',
            [target.id],
        )
    }

    const table = tableForKind(target.kind)
    if (!table) {
        return false
    }

    await db.adapter.execute(`delete from ${table} where id = ?`, [target.id])
    return true
}

async function removeFromSearchIndex(
    db: DatabaseService,
    id: string,
): Promise<void> {
    await db.adapter.execute(
        'delete from memory_fts where rowid in (select rowid from memory_fts where id = ?)',
        [id],
    )
    await db.adapter.execute('delete from memory_fts_indexed where id = ?', [
        id,
    ])
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

function tableForKind(kind: TargetKind): string | undefined {
    if (kind === 'chunk') {
        return 'chunks'
    }
    if (kind === 'observation') {
        return 'observations'
    }
    if (kind === 'diary_entry') {
        return 'diary_entries'
    }

    return undefined
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

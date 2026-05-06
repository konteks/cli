import { randomUUID } from 'node:crypto'
import type { ForgetInput } from '../mcp/inputs.js'
import { appendMemoryEvent } from '../storage/event-log.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import { GraphStore } from './graph-store.js'
import { searchMemory } from './search-store.js'

type ForgetResult = {
    accepted: boolean
    mode: NonNullable<ForgetInput['mode']>
    affectedIds: string[]
}

type TargetKind =
    | 'chunk'
    | 'diary_entry'
    | 'observation'
    | 'relation'
    | 'session_handoff'

type ForgetTarget = {
    id: string
    kind: TargetKind
}

export async function forgetMemory(
    adapter: SqliteAdapter,
    input: ForgetInput,
): Promise<ForgetResult> {
    const mode = input.mode ?? 'soft_delete'
    const targets = await resolveTargets(adapter, input)
    const affectedIds: string[] = []

    await adapter.transaction(async () => {
        for (const target of targets) {
            const changed = await applyForget(
                adapter,
                target,
                mode,
                input.reason,
            )
            if (!changed) {
                continue
            }

            await removeFromSearchIndex(adapter, target.id)
            await appendMemoryEvent(adapter, {
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
    adapter: SqliteAdapter,
    input: ForgetInput,
): Promise<ForgetTarget[]> {
    if (input.id) {
        return [{ id: input.id, kind: inferKind(input.id) }]
    }

    if (!input.query) {
        return []
    }

    const matches = await searchMemory(adapter, {
        limit: 10,
        query: input.query,
    })

    return matches.map(match => ({
        id: match.id,
        kind: inferKind(match.id),
    }))
}

async function applyForget(
    adapter: SqliteAdapter,
    target: ForgetTarget,
    mode: NonNullable<ForgetInput['mode']>,
    reason: string | undefined,
): Promise<boolean> {
    if (target.kind === 'relation') {
        await new GraphStore(adapter).invalidateRelation(target.id)
        return true
    }

    if (mode === 'invalidate') {
        return markSuppressed(adapter, target, reason)
    }

    if (mode === 'hard_delete') {
        return hardDelete(adapter, target)
    }

    return markForgotten(adapter, target, reason)
}

async function markForgotten(
    adapter: SqliteAdapter,
    target: ForgetTarget,
    reason: string | undefined,
): Promise<boolean> {
    const table = tableForKind(target.kind)
    if (!table) {
        return false
    }

    await adapter.execute(
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
    adapter: SqliteAdapter,
    target: ForgetTarget,
    reason: string | undefined,
): Promise<boolean> {
    const table = tableForKind(target.kind)
    if (!table) {
        return false
    }

    await adapter.execute(
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
    adapter: SqliteAdapter,
    target: ForgetTarget,
): Promise<boolean> {
    if (target.kind === 'chunk') {
        await adapter.execute(
            'delete from taxonomy_links where target_id = ?',
            [target.id],
        )
    }

    const table = tableForKind(target.kind)
    if (!table) {
        return false
    }

    await adapter.execute(`delete from ${table} where id = ?`, [target.id])
    return true
}

async function removeFromSearchIndex(
    adapter: SqliteAdapter,
    id: string,
): Promise<void> {
    await adapter.execute(
        'delete from memory_fts where rowid in (select rowid from memory_fts where id = ?)',
        [id],
    )
    await adapter.execute('delete from memory_fts_indexed where id = ?', [id])
}

function inferKind(id: string): TargetKind {
    if (id.startsWith('chunk_')) {
        return 'chunk'
    }
    if (id.startsWith('handoff_')) {
        return 'session_handoff'
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
    if (kind === 'session_handoff') {
        return 'session_handoffs'
    }
    if (kind === 'diary_entry') {
        return 'diary_entries'
    }

    return undefined
}

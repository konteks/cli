import type { SqliteAdapter } from '../storage/sqlite-adapter.js'

type SearchDocument = {
    id: string
    type: 'chunk' | 'memory' | 'session'
    kind?: string
    task?: string
    content: string
    createdAt: string
}

type FtsTableRow = {
    name: string
}

export async function ensureSearchIndex(
    adapter: SqliteAdapter,
): Promise<boolean> {
    await adapter.execute(`
create table if not exists memory_fts_indexed (
    id text primary key,
    indexed_at text not null
);
`)

    try {
        await adapter.execute(`
create virtual table if not exists memory_fts using fts5(
    id unindexed,
    type unindexed,
    kind,
    task,
    content,
    created_at unindexed
);
`)
    } catch {
        return false
    }

    await backfillSearchIndex(adapter)
    return true
}

export async function hasSearchIndex(adapter: SqliteAdapter): Promise<boolean> {
    const rows = await adapter.query<FtsTableRow>(
        `
select name
from sqlite_master
where type = 'table' and name = 'memory_fts'
limit 1
`,
    )

    return rows.length > 0
}

export async function indexSearchDocument(
    adapter: SqliteAdapter,
    document: SearchDocument,
): Promise<void> {
    if (!(await hasSearchIndex(adapter))) {
        return
    }

    await adapter.execute(
        `
insert into memory_fts (id, type, kind, task, content, created_at)
values (?, ?, ?, ?, ?, ?)
`,
        [
            document.id,
            document.type,
            document.kind ?? null,
            document.task ?? null,
            document.content,
            document.createdAt,
        ],
    )
    await markIndexed(adapter, document.id)
}

async function backfillSearchIndex(adapter: SqliteAdapter): Promise<void> {
    await adapter.execute(`
insert into memory_fts (id, type, kind, task, content, created_at)
select o.id, 'memory', o.kind, null, coalesce(o.text_inline, ''), o.created_at
from observations o
left join memory_fts_indexed i on i.id = o.id
where i.id is null
  and o.deleted_at is null
  and o.suppressed_at is null;
`)
    await adapter.execute(`
insert into memory_fts_indexed (id, indexed_at)
select o.id, datetime('now')
from observations o
left join memory_fts_indexed i on i.id = o.id
where i.id is null
  and o.deleted_at is null
  and o.suppressed_at is null;
`)
    await adapter.execute(`
insert into memory_fts (id, type, kind, task, content, created_at)
select h.id, 'session', h.status, h.task, h.summary, h.created_at
from session_handoffs h
left join memory_fts_indexed i on i.id = h.id
where i.id is null
  and h.deleted_at is null
  and h.suppressed_at is null;
`)
    await adapter.execute(`
insert into memory_fts_indexed (id, indexed_at)
select h.id, datetime('now')
from session_handoffs h
left join memory_fts_indexed i on i.id = h.id
where i.id is null
  and h.deleted_at is null
  and h.suppressed_at is null;
`)
}

async function markIndexed(adapter: SqliteAdapter, id: string): Promise<void> {
    await adapter.execute(
        `
insert or replace into memory_fts_indexed (id, indexed_at)
values (?, ?)
`,
        [id, new Date().toISOString()],
    )
}

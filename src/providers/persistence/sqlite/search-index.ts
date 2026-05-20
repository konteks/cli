import type { SqliteConnection } from '@/database/actions/_db'
import { executeSql, querySql } from './libsql-helpers'

type SearchDocument = {
    id: string
    type: 'chunk' | 'diary' | 'memory'
    kind?: string
    task?: string
    content: string
    createdAt: string
}

type FtsTableRow = {
    name: string
}

export async function ensureSearchIndex(
    service: SqliteConnection,
): Promise<boolean> {
    await executeSql(
        service.client,
        `
create table if not exists memory_fts_indexed (
    id text primary key,
    indexed_at text not null
);
`,
    )

    try {
        await executeSql(
            service.client,
            `
create virtual table if not exists memory_fts using fts5(
    id unindexed,
    type unindexed,
    kind,
    task,
    content,
    created_at unindexed
);
`,
        )
    } catch {
        return false
    }

    await backfillSearchIndex(service)
    return true
}

export async function hasSearchIndex(
    service: SqliteConnection,
): Promise<boolean> {
    const rows = await querySql<FtsTableRow>(
        service.client,
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
    service: SqliteConnection,
    document: SearchDocument,
): Promise<void> {
    if (!(await hasSearchIndex(service))) {
        return
    }

    await executeSql(
        service.client,
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
    await markIndexed(service, document.id)
}

async function backfillSearchIndex(service: SqliteConnection): Promise<void> {
    await executeSql(
        service.client,
        `
insert into memory_fts (id, type, kind, task, content, created_at)
select o.id, 'memory', o.kind, null, coalesce(o.text_inline, ''), o.created_at
from observations o
left join memory_fts_indexed i on i.id = o.id
where i.id is null
  and o.deleted_at is null
  and o.suppressed_at is null;
`,
    )
    await executeSql(
        service.client,
        `
insert into memory_fts_indexed (id, indexed_at)
select o.id, datetime('now')
from observations o
left join memory_fts_indexed i on i.id = o.id
where i.id is null
  and o.deleted_at is null
  and o.suppressed_at is null;
`,
    )
    await executeSql(
        service.client,
        `
insert into memory_fts (id, type, kind, task, content, created_at)
select d.id, 'diary', 'diary', d.subject, d.summary, d.created_at
from diary_entries d
left join memory_fts_indexed i on i.id = d.id
where i.id is null
  and d.deleted_at is null
  and d.suppressed_at is null;
`,
    )
    await executeSql(
        service.client,
        `
insert into memory_fts_indexed (id, indexed_at)
select d.id, datetime('now')
from diary_entries d
left join memory_fts_indexed i on i.id = d.id
where i.id is null
  and d.deleted_at is null
  and d.suppressed_at is null;
`,
    )
}

async function markIndexed(
    service: SqliteConnection,
    id: string,
): Promise<void> {
    await executeSql(
        service.client,
        `
insert or replace into memory_fts_indexed (id, indexed_at)
values (?, ?)
`,
        [id, new Date().toISOString()],
    )
}

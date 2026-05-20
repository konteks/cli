import { sql } from 'drizzle-orm'
import getDb from './_db'

export default async function ensureSearchIndex(): Promise<boolean> {
    const db = await getDb()
    await db.run(sql`
create table if not exists memory_fts_indexed (
    id text primary key,
    indexed_at text not null
);
`)

    try {
        await db.run(sql`
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

    await backfillSearchIndex()
    return true
}

async function backfillSearchIndex(): Promise<void> {
    const db = await getDb()
    await db.run(sql`
insert into memory_fts (id, type, kind, task, content, created_at)
select o.id, 'memory', o.kind, null, coalesce(o.text_inline, ''), o.created_at
from observations o
left join memory_fts_indexed i on i.id = o.id
where i.id is null
  and o.deleted_at is null
  and o.suppressed_at is null;
`)
    await db.run(sql`
insert into memory_fts_indexed (id, indexed_at)
select o.id, datetime('now')
from observations o
left join memory_fts_indexed i on i.id = o.id
where i.id is null
  and o.deleted_at is null
  and o.suppressed_at is null;
`)
    await db.run(sql`
insert into memory_fts (id, type, kind, task, content, created_at)
select d.id, 'diary', 'diary', d.subject, d.summary, d.created_at
from diary_entries d
left join memory_fts_indexed i on i.id = d.id
where i.id is null
  and d.deleted_at is null
  and d.suppressed_at is null;
`)
    await db.run(sql`
insert into memory_fts_indexed (id, indexed_at)
select d.id, datetime('now')
from diary_entries d
left join memory_fts_indexed i on i.id = d.id
where i.id is null
  and d.deleted_at is null
  and d.suppressed_at is null;
`)
}

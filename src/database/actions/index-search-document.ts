import { sql } from 'drizzle-orm'
import getDb from './_db'
import hasSearchIndex from './has-search-index'

type SearchDocument = {
    id: string
    type: 'section' | 'diary' | 'memory'
    kind?: string
    task?: string
    content: string
    createdAt: string
}

export default async function indexSearchDocument(
    document: SearchDocument,
): Promise<void> {
    if (!(await hasSearchIndex())) {
        return
    }

    const db = await getDb()
    await db.run(sql`
insert into memory_fts (id, type, kind, task, content, created_at)
values (${document.id}, ${document.type}, ${document.kind ?? null}, ${document.task ?? null}, ${document.content}, ${document.createdAt})
`)
    await db.run(sql`
insert or replace into memory_fts_indexed (id, indexed_at)
values (${document.id}, ${new Date().toISOString()})
`)
}

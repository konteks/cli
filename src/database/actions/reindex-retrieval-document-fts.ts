import { sql } from 'drizzle-orm'
import { retrievalDocumentsFts } from '@/database/schema'
import getDb from './_db'

export default async function reindexRetrievalDocumentFts(): Promise<void> {
    const db = await getDb()
    await db.delete(retrievalDocumentsFts)
    await db.run(sql`
insert into retrieval_documents_fts (
    target_id,
    target_type,
    source_role,
    path,
    anchor,
    fts_text
)
select
    target_id,
    target_type,
    source_role,
    path,
    anchor,
    fts_text
from retrieval_documents
`)
}

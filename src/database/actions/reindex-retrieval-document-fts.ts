import { sql } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { retrievalDocumentsFts } from '@/database/schema'

export default async function reindexRetrievalDocumentFts(
    db: SqliteConnection,
): Promise<void> {
    await db.db.delete(retrievalDocumentsFts)
    await db.db.run(sql`
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

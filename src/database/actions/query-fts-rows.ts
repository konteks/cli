import { eq, sql } from 'drizzle-orm'
import { memoryFts, observations, sections } from '@/database/schema'
import getDb from './_db'

export type FtsRow = {
    id: string
    type: 'section' | 'diary' | 'memory'
    kind: string | null
    task: string | null
    content: string
    created_at: string
    rank: number
    source_id: string | null
    token_count: number | null
    confidence: number | null
}

export default async function queryFtsRows(
    ftsQuery: string,
    limit: number,
): Promise<FtsRow[]> {
    const db = await getDb()
    return db
        .select({
            confidence: observations.confidence,
            content: memoryFts.content,
            created_at: memoryFts.createdAt,
            id: memoryFts.id,
            kind: memoryFts.kind,
            rank: sql<number>`bm25(memory_fts)`,
            source_id: sections.sourceId,
            task: memoryFts.task,
            token_count: sections.tokenCount,
            type: memoryFts.type,
        })
        .from(memoryFts)
        .leftJoin(sections, eq(sections.id, memoryFts.id))
        .leftJoin(observations, eq(observations.id, memoryFts.id))
        .where(sql`
            memory_fts match ${ftsQuery}
            and not exists (
                select 1 from sections dc
                where dc.id = ${memoryFts.id}
                  and (dc.deleted_at is not null or dc.suppressed_at is not null)
            )
            and not exists (
                select 1 from observations do
                where do.id = ${memoryFts.id}
                  and (do.deleted_at is not null or do.suppressed_at is not null)
            )
            and not exists (
                select 1 from diary_entries dd
                where dd.id = ${memoryFts.id}
                  and (dd.deleted_at is not null or dd.suppressed_at is not null)
            )
        `)
        .orderBy(sql`rank`)
        .limit(limit)
}

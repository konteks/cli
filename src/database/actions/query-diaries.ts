import { and, desc, isNull, or, sql } from 'drizzle-orm'
import { diaryEntries } from '@/providers/persistence/sqlite/schema'
import db from './_db'

export type DiaryRow = {
    id: string
    subject: string | null
    summary: string
    tags_json: string | null
    created_at: string
}

export default async function queryDiaries(
    terms: string[],
    limit: number,
): Promise<DiaryRow[]> {
    return await db
        .select({
            created_at: diaryEntries.createdAt,
            id: diaryEntries.id,
            subject: diaryEntries.subject,
            summary: diaryEntries.summary,
            tags_json: diaryEntries.tagsJson,
        })
        .from(diaryEntries)
        .where(
            and(
                or(
                    ...terms.flatMap(term => [
                        sql`lower(${diaryEntries.summary}) like ${`%${term}%`}`,
                        sql`lower(coalesce(${diaryEntries.subject}, '')) like ${`%${term}%`}`,
                        sql`lower(coalesce(${diaryEntries.tagsJson}, '')) like ${`%${term}%`}`,
                    ]),
                ),
                isNull(diaryEntries.deletedAt),
                isNull(diaryEntries.suppressedAt),
            ),
        )
        .orderBy(desc(diaryEntries.createdAt))
        .limit(limit)
}

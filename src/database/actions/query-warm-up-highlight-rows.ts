import { sql } from 'drizzle-orm'
import { chunks, retrievalDocuments } from '@/database/schema'
import type { WarmUpHighlight } from '@/models/memory'
import db from './_db'

export type WarmUpHighlightRow = {
    anchor: string | null
    path: string | null
    source_role: string | null
    summary: string | null
    target_id: string
    target_type: WarmUpHighlight['type']
    token_count: number | null
    updated_at: string
}

export default async function queryWarmUpHighlightRows(): Promise<
    WarmUpHighlightRow[]
> {
    return db
        .select({
            anchor: retrievalDocuments.anchor,
            path: retrievalDocuments.path,
            source_role: retrievalDocuments.sourceRole,
            summary: retrievalDocuments.summary,
            target_id: retrievalDocuments.targetId,
            target_type: retrievalDocuments.targetType,
            token_count: chunks.tokenCount,
            updated_at: retrievalDocuments.updatedAt,
        })
        .from(retrievalDocuments)
        .leftJoin(
            chunks,
            sql`
                ${chunks.id} = ${retrievalDocuments.targetId}
                and ${retrievalDocuments.targetType} = 'chunk'
            `,
        )
        .where(sql`
            ${retrievalDocuments.targetType} in ('chunk', 'module', 'memory', 'diary')
            and not exists (
                select 1 from chunks dc
                where dc.id = ${retrievalDocuments.targetId}
                  and ${retrievalDocuments.targetType} = 'chunk'
                  and (dc.deleted_at is not null or dc.suppressed_at is not null)
            )
            and not exists (
                select 1 from observations mo
                where mo.id = ${retrievalDocuments.targetId}
                  and ${retrievalDocuments.targetType} = 'memory'
                  and (mo.deleted_at is not null or mo.suppressed_at is not null)
            )
            and not exists (
                select 1 from diary_entries dd
                where dd.id = ${retrievalDocuments.targetId}
                  and ${retrievalDocuments.targetType} = 'diary'
                  and (dd.deleted_at is not null or dd.suppressed_at is not null)
            )
        `)
        .orderBy(
            sql`case ${retrievalDocuments.targetType} when 'module' then 0 when 'chunk' then 1 else 2 end`,
            sql`case ${retrievalDocuments.sourceRole}
                when 'app_code' then 0
                when 'package_config' then 1
                when 'test_code' then 2
                when 'product_doc' then 3
                else 4
            end`,
            sql`${retrievalDocuments.updatedAt} desc`,
        )
        .limit(40)
}

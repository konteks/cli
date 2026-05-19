import { and, isNull, or, sql } from 'drizzle-orm'
import {
    type KonteksDatabase,
    querySql,
    type SqliteExecutor,
} from '../libsql-helpers'
import { observations } from '../schema'

export type ObservationRow = {
    id: string
    kind: string
    text_inline: string | null
    confidence: number
    created_at: string
}

export default class ObservationStore {
    public constructor(
        private readonly client: SqliteExecutor,
        private readonly db?: KonteksDatabase,
    ) {}

    public async findByTerms(
        terms: string[],
        limit: number,
    ): Promise<ObservationRow[]> {
        if (this.db) {
            const conditions = terms.map(
                term =>
                    sql`lower(coalesce(${observations.textInline}, '')) like ${`%${term}%`}`,
            )
            const rows = await this.db
                .select()
                .from(observations)
                .where(
                    and(
                        or(...conditions),
                        isNull(observations.deletedAt),
                        isNull(observations.suppressedAt),
                    ),
                )
                .orderBy(sql`${observations.createdAt} desc`)
                .limit(limit)

            return rows.map(row => ({
                confidence: row.confidence,
                created_at: row.createdAt,
                id: row.id,
                kind: row.kind,
                text_inline: row.textInline,
            }))
        }

        return querySql<ObservationRow>(
            this.client,
            `
select id, kind, text_inline, confidence, created_at
from observations
where (${terms.map(() => "lower(coalesce(text_inline, '')) like ?").join(' or ')})
  and deleted_at is null
  and suppressed_at is null
order by created_at desc
limit ?
`,
            [...terms.map(term => `%${term}%`), limit],
        )
    }
}

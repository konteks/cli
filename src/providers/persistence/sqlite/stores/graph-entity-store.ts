import { randomUUID } from 'node:crypto'
import type { SqliteAdapter } from '../sqlite-adapter'
import { entityFromRow } from './graph-row-mappers'
import type {
    EntityInput,
    EntityRecord,
    EntityRow,
    EntitySearchRow,
} from './graph-types'
import { normalizeEntityName, tokenize } from './graph-utils'

export default class GraphEntityStore {
    public constructor(private readonly adapter: SqliteAdapter) {}

    public async upsertEntity(input: EntityInput): Promise<EntityRecord> {
        const canonicalName = normalizeEntityName(input.name)
        const existing = await this.findEntityByCanonicalName(canonicalName)
        const now = new Date().toISOString()

        if (existing) {
            await this.adapter.execute(
                `
update entities
set type = ?, name = ?, summary = coalesce(?, summary), properties_json = coalesce(?, properties_json), updated_at = ?
where id = ?
`,
                [
                    input.type,
                    input.name,
                    input.summary ?? null,
                    input.properties ? JSON.stringify(input.properties) : null,
                    now,
                    existing.id,
                ],
            )
            await this.addAliases(existing.id, input.aliases ?? [], now)
            return {
                ...existing,
                name: input.name,
                summary: input.summary ?? existing.summary,
                type: input.type,
            }
        }

        const entity: EntityRecord = {
            canonicalName,
            id: `ent_${randomUUID()}`,
            name: input.name,
            summary: input.summary,
            type: input.type,
        }

        await this.adapter.transaction(async () => {
            await this.adapter.execute(
                `
insert into entities (
    id,
    type,
    name,
    canonical_name,
    summary,
    properties_json,
    created_at,
    updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?)
`,
                [
                    entity.id,
                    input.type,
                    input.name,
                    canonicalName,
                    input.summary ?? null,
                    input.properties ? JSON.stringify(input.properties) : null,
                    now,
                    now,
                ],
            )
            await this.addAliases(entity.id, input.aliases ?? [], now)
        })

        return entity
    }

    public async findEntityByCanonicalName(
        canonicalName: string,
    ): Promise<EntityRecord | undefined> {
        const normalized = normalizeEntityName(canonicalName)

        const rows = await this.adapter.query<EntityRow>(
            `
select id, type, name, canonical_name, summary
from entities
where canonical_name = ?
limit 1
`,
            [normalized],
        )

        return rows[0] ? entityFromRow(rows[0]) : undefined
    }

    public async searchEntities(
        query: string,
        options: { limit?: number } = {},
    ): Promise<EntityRecord[]> {
        const terms = tokenize(query)
        if (terms.length === 0) {
            return []
        }

        const rows = await this.adapter.query<EntitySearchRow>(
            `
select *
from (
select
    e.id,
    e.type,
    e.name,
    e.canonical_name,
    e.summary,
    (
        case when lower(e.name) in (${terms.map(() => '?').join(', ')}) then 4 else 0 end
        + case when ${terms.map(() => 'lower(e.name) like ?').join(' or ')} then 3 else 0 end
        + case when ${terms.map(() => "lower(coalesce(e.summary, '')) like ?").join(' or ')} then 1 else 0 end
        + case when exists (
            select 1
            from entity_aliases a
            where a.entity_id = e.id
              and (${terms.map(() => 'a.normalized_value like ?').join(' or ')})
        ) then 3 else 0 end
    ) as score
from entities e
) scored_entities
where score > 0
order by score desc
limit ?
`,
            [
                ...terms,
                ...terms.map(term => `%${term}%`),
                ...terms.map(term => `%${term}%`),
                ...terms.map(term => `%${term}%`),
                options.limit ?? 5,
            ],
        )

        return rows.map(entityFromRow)
    }

    private async addAliases(
        entityId: string,
        aliases: string[],
        createdAt: string,
    ): Promise<void> {
        for (const alias of aliases) {
            await this.adapter.execute(
                `
insert into entity_aliases (
    id,
    entity_id,
    value,
    normalized_value,
    created_at
) values (?, ?, ?, ?, ?)
`,
                [
                    `alias_${randomUUID()}`,
                    entityId,
                    alias,
                    normalizeEntityName(alias),
                    createdAt,
                ],
            )
        }
    }
}

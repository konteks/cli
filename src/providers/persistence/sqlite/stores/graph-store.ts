import { randomUUID } from 'node:crypto'
import type { KonteksDatabase, SqliteAdapter } from '../sqlite-adapter'
import {
    clampDepth,
    type GraphPathStep,
    normalizeEntityName,
    type PathRow,
    tokenize,
    toPathSteps,
} from './graph-utils'

type EntityInput = {
    type: string
    name: string
    summary?: string
    aliases?: string[]
    properties?: Record<string, unknown>
}

type EntityRecord = {
    id: string
    type: string
    name: string
    canonicalName: string
    summary?: string
}

type RelationInput = {
    subjectId: string
    predicate: string
    objectId: string
    confidence?: number
    validFrom?: string
    validTo?: string
    supersedesRelationId?: string
    properties?: Record<string, unknown>
}

type RelationRecord = {
    id: string
    subjectId: string
    predicate: string
    objectId: string
    confidence: number
    status: 'active' | 'invalidated' | 'superseded'
    validFrom?: string
    validTo?: string
}

type GraphNeighbor = {
    depth: number
    relationId: string
    predicate: string
    direction: 'incoming' | 'outgoing'
    entity: EntityRecord
}

type HistoricalRelation = {
    relationId: string
    predicate: string
    status: 'invalidated' | 'superseded'
    validFrom?: string
    validTo?: string
    subject: EntityRecord
    object: EntityRecord
}

type EntityRow = {
    id: string
    type: string
    name: string
    canonical_name: string
    summary: string | null
}

type EntitySearchRow = EntityRow & {
    score: number
}

type NeighborRow = EntityRow & {
    depth: number
    relation_id: string
    predicate: string
    direction: 'incoming' | 'outgoing'
}

type HistoricalRelationRow = {
    relation_id: string
    predicate: string
    status: 'invalidated' | 'superseded'
    valid_from: string | null
    valid_to: string | null
    subject_id: string
    subject_type: string
    subject_name: string
    subject_canonical_name: string
    subject_summary: string | null
    object_id: string
    object_type: string
    object_name: string
    object_canonical_name: string
    object_summary: string | null
}

export default class GraphStore {
    private readonly adapter: SqliteAdapter

    constructor(
        adapter: SqliteAdapter | { adapter: SqliteAdapter },
        _db?: KonteksDatabase,
    ) {
        this.adapter = 'adapter' in adapter ? adapter.adapter : adapter
    }

    async upsertEntity(input: EntityInput): Promise<EntityRecord> {
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

    async findEntityByCanonicalName(
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

    async searchEntities(
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

    async addRelation(input: RelationInput): Promise<RelationRecord> {
        const relation: RelationRecord = {
            confidence: input.confidence ?? 1,
            id: `rel_${randomUUID()}`,
            objectId: input.objectId,
            predicate: input.predicate,
            status: 'active',
            subjectId: input.subjectId,
            validFrom: input.validFrom,
            validTo: input.validTo,
        }
        const now = new Date().toISOString()

        const operation = async () => {
            if (input.supersedesRelationId) {
                await this.supersedeRelation(input.supersedesRelationId, now)
            }

            await this.adapter.execute(
                `
insert into relations (
    id,
    subject_id,
    predicate,
    object_id,
    confidence,
    status,
    valid_from,
    valid_to,
    supersedes_relation_id,
    properties_json,
    created_at,
    updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
                [
                    relation.id,
                    input.subjectId,
                    input.predicate,
                    input.objectId,
                    relation.confidence,
                    relation.status,
                    input.validFrom ?? null,
                    input.validTo ?? null,
                    input.supersedesRelationId ?? null,
                    input.properties ? JSON.stringify(input.properties) : null,
                    now,
                    now,
                ],
            )
        }

        await this.adapter.transaction(operation)

        return relation
    }

    async invalidateRelation(id: string, validTo?: string): Promise<void> {
        const now = new Date().toISOString()
        await this.adapter.execute(
            `
update relations
set status = 'invalidated', valid_to = coalesce(?, valid_to), updated_at = ?
where id = ?
`,
            [validTo ?? null, now, id],
        )
    }

    async traverseNeighbors(
        entityId: string,
        options: { maxDepth?: number; limit?: number } = {},
    ): Promise<GraphNeighbor[]> {
        const maxDepth = clampDepth(options.maxDepth ?? 1)
        const limit = options.limit ?? 25
        const rows = await this.adapter.query<NeighborRow>(
            `
with recursive walk(depth, entity_id, relation_id, predicate, direction, visited) as (
    select
        1,
        r.object_id,
        r.id,
        r.predicate,
        'outgoing',
        ? || ',' || r.object_id
    from relations r
    where r.subject_id = ? and r.status = 'active'

    union all

    select
        1,
        r.subject_id,
        r.id,
        r.predicate,
        'incoming',
        ? || ',' || r.subject_id
    from relations r
    where r.object_id = ? and r.status = 'active'

    union all

    select
        walk.depth + 1,
        r.object_id,
        r.id,
        r.predicate,
        'outgoing',
        walk.visited || ',' || r.object_id
    from walk
    join relations r on r.subject_id = walk.entity_id and r.status = 'active'
    where walk.depth < ? and instr(walk.visited, r.object_id) = 0

    union all

    select
        walk.depth + 1,
        r.subject_id,
        r.id,
        r.predicate,
        'incoming',
        walk.visited || ',' || r.subject_id
    from walk
    join relations r on r.object_id = walk.entity_id and r.status = 'active'
    where walk.depth < ? and instr(walk.visited, r.subject_id) = 0
)
select
    walk.depth,
    walk.relation_id,
    walk.predicate,
    walk.direction,
    e.id,
    e.type,
    e.name,
    e.canonical_name,
    e.summary
from walk
join entities e on e.id = walk.entity_id
order by walk.depth, e.name
limit ?
`,
            [entityId, entityId, entityId, entityId, maxDepth, maxDepth, limit],
        )

        return rows.map(row => ({
            depth: row.depth,
            direction: row.direction,
            entity: entityFromRow(row),
            predicate: row.predicate,
            relationId: row.relation_id,
        }))
    }

    async historicalRelations(
        entityId: string,
        options: { limit?: number } = {},
    ): Promise<HistoricalRelation[]> {
        const rows = await this.adapter.query<HistoricalRelationRow>(
            `
select
    r.id as relation_id,
    r.predicate,
    r.status,
    r.valid_from,
    r.valid_to,
    s.id as subject_id,
    s.type as subject_type,
    s.name as subject_name,
    s.canonical_name as subject_canonical_name,
    s.summary as subject_summary,
    o.id as object_id,
    o.type as object_type,
    o.name as object_name,
    o.canonical_name as object_canonical_name,
    o.summary as object_summary
from relations r
join entities s on s.id = r.subject_id
join entities o on o.id = r.object_id
where (r.subject_id = ? or r.object_id = ?)
  and r.status in ('invalidated', 'superseded')
order by r.updated_at desc
limit ?
`,
            [entityId, entityId, options.limit ?? 10],
        )

        return rows.map(row => ({
            object: entityFromHistoricalRow(row, 'object'),
            predicate: row.predicate,
            relationId: row.relation_id,
            status: row.status,
            subject: entityFromHistoricalRow(row, 'subject'),
            validFrom: row.valid_from ?? undefined,
            validTo: row.valid_to ?? undefined,
        }))
    }

    async findPath(
        fromEntityId: string,
        toEntityId: string,
        maxDepth = 3,
    ): Promise<GraphPathStep[]> {
        const rows = await this.adapter.query<PathRow>(
            `
with recursive path(depth, entity_id, entity_path, relation_path, predicate_path) as (
    select
        0,
        ?,
        ?,
        '',
        ''

    union all

    select
        path.depth + 1,
        r.object_id,
        path.entity_path || ',' || r.object_id,
        case when path.relation_path = '' then r.id else path.relation_path || ',' || r.id end,
        case when path.predicate_path = '' then r.predicate else path.predicate_path || ',' || r.predicate end
    from path
    join relations r on r.subject_id = path.entity_id and r.status = 'active'
    where path.depth < ? and instr(path.entity_path, r.object_id) = 0
)
select entity_path, relation_path, predicate_path
from path
where entity_id = ? and depth > 0
order by depth
limit 1
`,
            [fromEntityId, fromEntityId, clampDepth(maxDepth), toEntityId],
        )
        const row = rows[0]
        if (!row) {
            return []
        }

        return toPathSteps(row)
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

    private async supersedeRelation(
        id: string,
        updatedAt: string,
    ): Promise<void> {
        await this.adapter.execute(
            `
update relations
set status = 'superseded', updated_at = ?
where id = ?
`,
            [updatedAt, id],
        )
    }
}

// biome-ignore lint/suspicious/noExplicitAny: WILL FIX THIS LATER
function entityFromRow(row: any): EntityRecord {
    return {
        canonicalName: row.canonical_name ?? row.canonicalName,
        id: row.id,
        name: row.name,
        summary: row.summary ?? undefined,
        type: row.type,
    }
}

function entityFromHistoricalRow(
    row: HistoricalRelationRow,
    side: 'object' | 'subject',
): EntityRecord {
    return {
        canonicalName:
            side === 'subject'
                ? row.subject_canonical_name
                : row.object_canonical_name,
        id: side === 'subject' ? row.subject_id : row.object_id,
        name: side === 'subject' ? row.subject_name : row.object_name,
        summary:
            (side === 'subject' ? row.subject_summary : row.object_summary) ??
            undefined,
        type: side === 'subject' ? row.subject_type : row.object_type,
    }
}

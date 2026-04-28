import { randomUUID } from 'node:crypto'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'

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

type GraphPathStep = {
    depth: number
    relationId: string
    fromEntityId: string
    predicate: string
    toEntityId: string
}

type EntityRow = {
    id: string
    type: string
    name: string
    canonical_name: string
    summary: string | null
}

type NeighborRow = EntityRow & {
    depth: number
    relation_id: string
    predicate: string
    direction: 'incoming' | 'outgoing'
}

type PathRow = {
    relation_path: string
    entity_path: string
    predicate_path: string
}

export class GraphStore {
    constructor(private readonly adapter: SqliteAdapter) {}

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

        await this.adapter.transaction(async () => {
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
        })

        return relation
    }

    async invalidateRelation(id: string, validTo?: string): Promise<void> {
        await this.adapter.execute(
            `
update relations
set status = 'invalidated', valid_to = coalesce(?, valid_to), updated_at = ?
where id = ?
`,
            [validTo ?? null, new Date().toISOString(), id],
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

function entityFromRow(row: EntityRow): EntityRecord {
    return {
        canonicalName: row.canonical_name,
        id: row.id,
        name: row.name,
        summary: row.summary ?? undefined,
        type: row.type,
    }
}

function normalizeEntityName(name: string): string {
    return name.trim().toLowerCase().replaceAll(/\s+/gu, ' ')
}

function clampDepth(depth: number): number {
    return Math.max(1, Math.min(Math.trunc(depth), 5))
}

function toPathSteps(row: PathRow): GraphPathStep[] {
    const entities = row.entity_path.split(',')
    const relations = row.relation_path.split(',').filter(Boolean)
    const predicates = row.predicate_path.split(',').filter(Boolean)

    return relations.map((relationId, index) => ({
        depth: index + 1,
        fromEntityId: entities[index] ?? '',
        predicate: predicates[index] ?? '',
        relationId,
        toEntityId: entities[index + 1] ?? '',
    }))
}

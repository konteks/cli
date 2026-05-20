import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import db from '../actions/_db'

export type EntityInput = {
    type: string
    name: string
    summary?: string
    aliases?: string[]
    properties?: Record<string, unknown>
}

export type EntityRecord = {
    id: string
    type: string
    name: string
    canonicalName: string
    summary?: string
}

export type RelationInput = {
    subjectId: string
    predicate: string
    objectId: string
    confidence?: number
    validFrom?: string
    validTo?: string
    supersedesRelationId?: string
    properties?: Record<string, unknown>
}

export type RelationRecord = {
    id: string
    subjectId: string
    predicate: string
    objectId: string
    confidence: number
    status: 'active' | 'invalidated' | 'superseded'
    validFrom?: string
    validTo?: string
}

export type GraphNeighbor = {
    depth: number
    relationId: string
    predicate: string
    direction: 'incoming' | 'outgoing'
    entity: EntityRecord
}

export type HistoricalRelation = {
    relationId: string
    predicate: string
    status: 'invalidated' | 'superseded'
    validFrom?: string
    validTo?: string
    subject: EntityRecord
    object: EntityRecord
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

type PathRow = {
    relation_path: string
    entity_path: string
    predicate_path: string
}

export async function upsertEntity(input: EntityInput): Promise<EntityRecord> {
    await db.ensureActionDatabase()
    const canonicalName = normalizeEntityName(input.name)
    const existing = await findEntityByCanonicalName(canonicalName)
    const now = new Date().toISOString()

    if (existing) {
        await db.run(sql`
update entities
set type = ${input.type},
    name = ${input.name},
    summary = coalesce(${input.summary ?? null}, summary),
    properties_json = coalesce(${input.properties ? JSON.stringify(input.properties) : null}, properties_json),
    updated_at = ${now}
where id = ${existing.id}
`)
        await addAliases(existing.id, input.aliases ?? [], now)
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

    await db.run(sql`
insert into entities (
    id, type, name, canonical_name, summary, properties_json, created_at, updated_at
) values (
    ${entity.id},
    ${input.type},
    ${input.name},
    ${canonicalName},
    ${input.summary ?? null},
    ${input.properties ? JSON.stringify(input.properties) : null},
    ${now},
    ${now}
)
`)
    await addAliases(entity.id, input.aliases ?? [], now)

    return entity
}

export async function findEntityByCanonicalName(
    canonicalName: string,
): Promise<EntityRecord | undefined> {
    await db.ensureActionDatabase()
    const rows = await db.all<EntityRow>(sql`
select id, type, name, canonical_name, summary
from entities
where canonical_name = ${normalizeEntityName(canonicalName)}
limit 1
`)

    return rows[0] ? entityFromRow(rows[0]) : undefined
}

export async function searchEntities(
    query: string,
    options: { limit?: number } = {},
): Promise<EntityRecord[]> {
    await db.ensureActionDatabase()
    const terms = tokenize(query)
    if (terms.length === 0) {
        return []
    }

    const rows = await db.all<EntitySearchRow>(sql`
select *
from (
select
    e.id,
    e.type,
    e.name,
    e.canonical_name,
    e.summary,
    (
        case when lower(e.name) in (${sql.join(
            terms.map(term => sql`${term}`),
            sql`, `,
        )}) then 4 else 0 end
        + case when ${sql.join(
            terms.map(term => sql`lower(e.name) like ${`%${term}%`}`),
            sql` or `,
        )} then 3 else 0 end
        + case when ${sql.join(
            terms.map(
                term => sql`lower(coalesce(e.summary, '')) like ${`%${term}%`}`,
            ),
            sql` or `,
        )} then 1 else 0 end
        + case when exists (
            select 1
            from entity_aliases a
            where a.entity_id = e.id
              and (${sql.join(
                  terms.map(
                      term => sql`a.normalized_value like ${`%${term}%`}`,
                  ),
                  sql` or `,
              )})
        ) then 3 else 0 end
    ) as score
from entities e
) scored_entities
where score > 0
order by score desc
limit ${options.limit ?? 5}
`)

    return rows.map(entityFromRow)
}

export async function addRelation(
    input: RelationInput,
): Promise<RelationRecord> {
    await db.ensureActionDatabase()
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

    if (input.supersedesRelationId) {
        await supersedeRelation(input.supersedesRelationId, now)
    }

    await db.run(sql`
insert into relations (
    id, subject_id, predicate, object_id, confidence, status, valid_from,
    valid_to, supersedes_relation_id, properties_json, created_at, updated_at
) values (
    ${relation.id},
    ${input.subjectId},
    ${input.predicate},
    ${input.objectId},
    ${relation.confidence},
    ${relation.status},
    ${input.validFrom ?? null},
    ${input.validTo ?? null},
    ${input.supersedesRelationId ?? null},
    ${input.properties ? JSON.stringify(input.properties) : null},
    ${now},
    ${now}
)
`)

    return relation
}

export async function invalidateRelation(
    id: string,
    validTo?: string,
): Promise<void> {
    await db.ensureActionDatabase()
    await db.run(sql`
update relations
set status = 'invalidated',
    valid_to = coalesce(${validTo ?? null}, valid_to),
    updated_at = ${new Date().toISOString()}
where id = ${id}
`)
}

export async function traverseNeighbors(
    entityId: string,
    options: { maxDepth?: number; limit?: number } = {},
): Promise<GraphNeighbor[]> {
    await db.ensureActionDatabase()
    const maxDepth = clampDepth(options.maxDepth ?? 1)
    const rows = await db.all<NeighborRow>(sql`
with recursive walk(depth, entity_id, relation_id, predicate, direction, visited) as (
    select 1, r.object_id, r.id, r.predicate, 'outgoing', ${entityId} || ',' || r.object_id
    from relations r
    where r.subject_id = ${entityId} and r.status = 'active'
    union all
    select 1, r.subject_id, r.id, r.predicate, 'incoming', ${entityId} || ',' || r.subject_id
    from relations r
    where r.object_id = ${entityId} and r.status = 'active'
    union all
    select walk.depth + 1, r.object_id, r.id, r.predicate, 'outgoing', walk.visited || ',' || r.object_id
    from walk
    join relations r on r.subject_id = walk.entity_id and r.status = 'active'
    where walk.depth < ${maxDepth} and instr(walk.visited, r.object_id) = 0
    union all
    select walk.depth + 1, r.subject_id, r.id, r.predicate, 'incoming', walk.visited || ',' || r.subject_id
    from walk
    join relations r on r.object_id = walk.entity_id and r.status = 'active'
    where walk.depth < ${maxDepth} and instr(walk.visited, r.subject_id) = 0
)
select walk.depth, walk.relation_id, walk.predicate, walk.direction,
       e.id, e.type, e.name, e.canonical_name, e.summary
from walk
join entities e on e.id = walk.entity_id
order by walk.depth, e.name
limit ${options.limit ?? 25}
`)

    return rows.map(row => ({
        depth: row.depth,
        direction: row.direction,
        entity: entityFromRow(row),
        predicate: row.predicate,
        relationId: row.relation_id,
    }))
}

export async function historicalRelations(
    entityId: string,
    options: { limit?: number } = {},
): Promise<HistoricalRelation[]> {
    await db.ensureActionDatabase()
    const rows = await db.all<HistoricalRelationRow>(sql`
select
    r.id as relation_id, r.predicate, r.status, r.valid_from, r.valid_to,
    s.id as subject_id, s.type as subject_type, s.name as subject_name,
    s.canonical_name as subject_canonical_name, s.summary as subject_summary,
    o.id as object_id, o.type as object_type, o.name as object_name,
    o.canonical_name as object_canonical_name, o.summary as object_summary
from relations r
join entities s on s.id = r.subject_id
join entities o on o.id = r.object_id
where (r.subject_id = ${entityId} or r.object_id = ${entityId})
  and r.status in ('invalidated', 'superseded')
order by r.updated_at desc
limit ${options.limit ?? 10}
`)

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

export async function findPath(
    fromEntityId: string,
    toEntityId: string,
    maxDepth = 3,
): Promise<GraphPathStep[]> {
    await db.ensureActionDatabase()
    const rows = await db.all<PathRow>(sql`
with recursive path(depth, entity_id, entity_path, relation_path, predicate_path) as (
    select 0, ${fromEntityId}, ${fromEntityId}, '', ''
    union all
    select path.depth + 1, r.object_id, path.entity_path || ',' || r.object_id,
           case when path.relation_path = '' then r.id else path.relation_path || ',' || r.id end,
           case when path.predicate_path = '' then r.predicate else path.predicate_path || ',' || r.predicate end
    from path
    join relations r on r.subject_id = path.entity_id and r.status = 'active'
    where path.depth < ${clampDepth(maxDepth)} and instr(path.entity_path, r.object_id) = 0
)
select entity_path, relation_path, predicate_path
from path
where entity_id = ${toEntityId} and depth > 0
order by depth
limit 1
`)
    return rows[0] ? toPathSteps(rows[0]) : []
}

async function addAliases(
    entityId: string,
    aliases: string[],
    createdAt: string,
): Promise<void> {
    for (const alias of aliases) {
        await db.run(sql`
insert into entity_aliases (id, entity_id, value, normalized_value, created_at)
values (${`alias_${randomUUID()}`}, ${entityId}, ${alias}, ${normalizeEntityName(alias)}, ${createdAt})
`)
    }
}

async function supersedeRelation(id: string, updatedAt: string): Promise<void> {
    await db.run(sql`
update relations
set status = 'superseded', updated_at = ${updatedAt}
where id = ${id}
`)
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

function normalizeEntityName(name: string): string {
    return name.trim().toLowerCase().replaceAll(/\s+/gu, ' ')
}

function tokenize(query: string): string[] {
    return [
        ...new Set(
            query
                .toLowerCase()
                .split(/[^a-z0-9_./-]+/u)
                .map(term => term.trim())
                .filter(term => term.length >= 2),
        ),
    ].slice(0, 8)
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

import { sql } from 'drizzle-orm'
import getDb from '@/database/actions/_db'
import searchEntities from '@/database/actions/search-entities'
import traverseNeighbors, {
    type TraversedNeighbor,
    traverseNeighborsForEntities,
} from '@/database/actions/traverse-neighbors'
import { normalizeEntityAlias } from '@/database/services/graph'
import type {
    MemoryEntity,
    MemorySearchResult,
    RecallGraphItem,
} from '@/types/memory'

const DIRECT_ENTITY_LIMIT = 4
const MAPPED_RESULT_LIMIT = 12
const NEIGHBOR_LIMIT = 8

type EntityRow = {
    id: string
    type: string
    name: string
    canonical_name: string
    summary: string | null
}

type AliasEntityRow = EntityRow & {
    normalized_value: string
}

type TargetEntityRow = EntityRow & {
    target_id: string
    target_type: string
}

export type RetrievalGraphContext = {
    entities: MemoryEntity[]
    graph: RecallGraphItem[]
    boosts: Map<string, number>
}

export async function buildRetrievalGraphContext(
    query: string,
    results: MemorySearchResult[],
): Promise<RetrievalGraphContext> {
    if (results.length === 0) {
        return emptyContext()
    }

    const directEntities = await searchEntities(query, {
        limit: DIRECT_ENTITY_LIMIT,
    })
    const mapped = await mapResultsToEntities(
        results.slice(0, MAPPED_RESULT_LIMIT),
    )
    const entities = dedupeEntities([
        ...directEntities,
        ...[...mapped.values()].flat(),
    ])

    if (entities.length === 0) {
        return emptyContext()
    }

    const graph = await graphItemsForEntities(entities)
    const relatedEntityIds = new Set<string>()
    for (const item of graph) {
        relatedEntityIds.add(item.entityId)
        relatedEntityIds.add(item.relatedEntityId)
    }

    const boosts = new Map<string, number>()
    for (const result of results) {
        const resultEntities = mapped.get(resultKey(result)) ?? []
        const relatedCount = resultEntities.filter(entity =>
            relatedEntityIds.has(entity.id),
        ).length
        if (relatedCount === 0) {
            continue
        }
        boosts.set(resultKey(result), Math.min(45, relatedCount * 15))
    }

    return {
        boosts,
        entities,
        graph,
    }
}

export function resultKey(result: Pick<MemorySearchResult, 'id' | 'type'>) {
    return `${result.type}:${result.id}`
}

async function mapResultsToEntities(
    results: MemorySearchResult[],
): Promise<Map<string, MemoryEntity[]>> {
    const mapped = new Map<string, MemoryEntity[]>()
    const targetRows = await queryTargetEntities(results)
    for (const row of targetRows) {
        const key = `${row.target_type}:${row.target_id}`
        mapped.set(key, [...(mapped.get(key) ?? []), entityFromRow(row)])
    }

    const aliasRows = await queryAliasEntities(aliasValuesForResults(results))
    for (const result of results) {
        const aliases = new Set(
            aliasValuesForResult(result).map(normalizeEntityAlias),
        )
        const matches = aliasRows
            .filter(row => aliases.has(row.normalized_value))
            .map(entityFromRow)
        if (matches.length > 0) {
            const key = resultKey(result)
            mapped.set(key, [...(mapped.get(key) ?? []), ...matches])
        }
    }

    return new Map(
        [...mapped.entries()].map(([key, entities]) => [
            key,
            dedupeEntities(entities),
        ]),
    )
}

async function queryTargetEntities(
    results: MemorySearchResult[],
): Promise<TargetEntityRow[]> {
    const db = await getDb()
    const targets = results
        .filter(result => result.type === 'section' || result.type === 'module')
        .map(result => ({
            id: result.id,
            type: result.type,
        }))
    if (targets.length === 0) {
        return []
    }

    const targetConditions = sql.join(
        targets.map(
            target =>
                sql`(target_id = ${target.id} and target_type = ${target.type})`,
        ),
        sql` or `,
    )

    return await db.all<TargetEntityRow>(sql`
with target_entities(target_id, target_type, entity_id) as (
    select s.id, 'section', je.value
    from sections s, json_each(coalesce(s.entities_json, '[]')) je
    union all
    select m.id, 'module', je.value
    from modules m, json_each(coalesce(m.entities_json, '[]')) je
)
select
    te.target_id,
    te.target_type,
    e.id,
    e.type,
    e.name,
    e.canonical_name,
    e.summary
from target_entities te
join entities e on e.id = te.entity_id
where ${targetConditions}
`)
}

async function queryAliasEntities(values: string[]): Promise<AliasEntityRow[]> {
    const normalizedValues = [
        ...new Set(values.map(normalizeEntityAlias).filter(Boolean)),
    ]
    if (normalizedValues.length === 0) {
        return []
    }

    const db = await getDb()
    return await db.all<AliasEntityRow>(sql`
select distinct
    a.normalized_value,
    e.id,
    e.type,
    e.name,
    e.canonical_name,
    e.summary
from entity_aliases a
join entities e on e.id = a.entity_id
where a.normalized_value in (${sql.join(
        normalizedValues.map(value => sql`${value}`),
        sql`, `,
    )})
`)
}

async function graphItemsForEntities(
    entities: MemoryEntity[],
): Promise<RecallGraphItem[]> {
    const seenRelations = new Set<string>()
    const graph: RecallGraphItem[] = []
    const entitiesById = new Map(entities.map(entity => [entity.id, entity]))
    const neighbors =
        entities.length === 1
            ? (
                  await traverseNeighbors(entities[0].id, {
                      limit: NEIGHBOR_LIMIT,
                      maxDepth: 2,
                  })
              ).map(neighbor => ({
                  ...neighbor,
                  originId: entities[0].id,
              }))
            : await traverseNeighborsForEntities(
                  entities.map(entity => entity.id),
                  {
                      limit: NEIGHBOR_LIMIT,
                      maxDepth: 2,
                  },
              )
    const neighborsByOrigin = new Map<string, TraversedNeighbor[]>()
    for (const neighbor of neighbors) {
        neighborsByOrigin.set(neighbor.originId, [
            ...(neighborsByOrigin.get(neighbor.originId) ?? []),
            neighbor,
        ])
    }

    for (const inputEntity of entities) {
        for (const neighbor of neighborsByOrigin.get(inputEntity.id) ?? []) {
            if (seenRelations.has(neighbor.relationId)) {
                continue
            }
            const entity = entitiesById.get(neighbor.originId)
            if (!entity) {
                continue
            }
            seenRelations.add(neighbor.relationId)
            graph.push({
                depth: neighbor.depth,
                direction: neighbor.direction,
                entityId: entity.id,
                entityName: entity.name,
                entityType: entity.type,
                predicate: neighbor.predicate,
                relatedEntityId: neighbor.entity.id,
                relatedEntityName: neighbor.entity.name,
                relatedEntityType: neighbor.entity.type,
                relationId: neighbor.relationId,
                score: Math.max(1, 10 - neighbor.depth * 2),
            })
        }
    }

    return graph
}

function aliasValuesForResults(results: MemorySearchResult[]): string[] {
    return results.flatMap(aliasValuesForResult)
}

function aliasValuesForResult(result: MemorySearchResult): string[] {
    return [
        result.id,
        `${result.type}#${result.id}`,
        result.path,
        result.anchor,
        result.path && result.anchor ? `${result.path}#${result.anchor}` : '',
    ].filter((value): value is string => Boolean(value))
}

function dedupeEntities(entities: MemoryEntity[]): MemoryEntity[] {
    const seen = new Set<string>()
    return entities.filter(entity => {
        if (seen.has(entity.id)) {
            return false
        }
        seen.add(entity.id)
        return true
    })
}

function entityFromRow(row: EntityRow): MemoryEntity {
    return {
        canonicalName: row.canonical_name,
        id: row.id,
        name: row.name,
        summary: row.summary ?? undefined,
        type: row.type,
    }
}

function emptyContext(): RetrievalGraphContext {
    return {
        boosts: new Map(),
        entities: [],
        graph: [],
    }
}

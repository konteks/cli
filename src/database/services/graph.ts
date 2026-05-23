import { basename, extname } from 'node:path/posix'
import { and, eq, like, sql } from 'drizzle-orm'
import getDb from '@/database/actions/_db'
import { entities, entityAliases, relations } from '@/database/schema'
import contentHash from '@/support/content-hash'
import type { MemoryEntity } from '@/types/memory'

export const GRAPH_ENTITY_TYPES = [
    'module',
    'file',
    'symbol',
    'package',
    'command',
    'config',
    'doc',
    'memory',
    'diary',
] as const

export const GRAPH_RELATION_PREDICATES = [
    'contains',
    'defines',
    'imports',
    'uses_package',
    'concerns',
    'applies_to',
    'covers',
    'supersedes',
] as const

export type GraphEntityType = (typeof GRAPH_ENTITY_TYPES)[number]
export type GraphRelationPredicate = (typeof GRAPH_RELATION_PREDICATES)[number]

export type GraphEntityInput = {
    type: GraphEntityType
    name: string
    canonicalName: string
    summary?: string
    properties?: Record<string, unknown>
}

export type GraphEntityAlias = {
    id: string
    entityId: string
    value: string
    normalizedValue: string
}

export type GraphRelationInput = {
    subjectId: string
    predicate: GraphRelationPredicate
    objectId: string
    confidence?: number
    evidenceKey?: string
    properties?: Record<string, unknown>
    status?: 'active' | 'invalidated' | 'superseded'
    supersedesRelationId?: string
    validFrom?: string
    validTo?: string
}

export type GraphRelation = {
    id: string
    subjectId: string
    predicate: GraphRelationPredicate
    objectId: string
    confidence: number
    status: 'active' | 'invalidated' | 'superseded'
    validFrom?: string
    validTo?: string
    supersedesRelationId?: string
    properties?: Record<string, unknown>
}

export async function upsertEntity(
    input: GraphEntityInput,
): Promise<MemoryEntity> {
    const db = await getDb()
    const id = entityIdFor(input.type, input.canonicalName)
    const now = new Date().toISOString()
    const propertiesJson = input.properties
        ? JSON.stringify(input.properties)
        : null

    await db
        .insert(entities)
        .values({
            canonicalName: input.canonicalName,
            createdAt: now,
            id,
            name: input.name,
            propertiesJson,
            summary: input.summary ?? null,
            type: input.type,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            set: {
                canonicalName: input.canonicalName,
                name: input.name,
                propertiesJson,
                summary: input.summary ?? null,
                updatedAt: now,
            },
            target: entities.id,
        })

    return {
        canonicalName: input.canonicalName,
        id,
        name: input.name,
        properties: input.properties,
        summary: input.summary,
        type: input.type,
    }
}

export async function upsertEntityAliases(
    entityId: string,
    aliases: string[],
): Promise<GraphEntityAlias[]> {
    const db = await getDb()
    const now = new Date().toISOString()
    const uniqueAliases = dedupeAliases(aliases)
    const results: GraphEntityAlias[] = []

    for (const alias of uniqueAliases) {
        const normalizedValue = normalizeEntityAlias(alias)
        const id = entityAliasIdFor(entityId, normalizedValue)
        await db
            .insert(entityAliases)
            .values({
                createdAt: now,
                entityId,
                id,
                normalizedValue,
                value: alias,
            })
            .onConflictDoUpdate({
                set: {
                    normalizedValue,
                    value: alias,
                },
                target: entityAliases.id,
            })
        results.push({
            entityId,
            id,
            normalizedValue,
            value: alias,
        })
    }

    return results
}

export async function upsertRelation(
    input: GraphRelationInput,
): Promise<GraphRelation> {
    const db = await getDb()
    const now = new Date().toISOString()
    const id = relationIdFor(input)
    const propertiesJson = input.properties
        ? JSON.stringify(input.properties)
        : null
    const status = input.status ?? 'active'
    const confidence = input.confidence ?? 1

    await db
        .insert(relations)
        .values({
            confidence,
            createdAt: now,
            id,
            objectId: input.objectId,
            predicate: input.predicate,
            propertiesJson,
            status,
            subjectId: input.subjectId,
            supersedesRelationId: input.supersedesRelationId ?? null,
            updatedAt: now,
            validFrom: input.validFrom ?? null,
            validTo: input.validTo ?? null,
        })
        .onConflictDoUpdate({
            set: {
                confidence,
                objectId: input.objectId,
                predicate: input.predicate,
                propertiesJson,
                status,
                subjectId: input.subjectId,
                supersedesRelationId: input.supersedesRelationId ?? null,
                updatedAt: now,
                validFrom: input.validFrom ?? null,
                validTo: input.validTo ?? null,
            },
            target: relations.id,
        })

    return {
        confidence,
        id,
        objectId: input.objectId,
        predicate: input.predicate,
        properties: input.properties,
        status,
        subjectId: input.subjectId,
        supersedesRelationId: input.supersedesRelationId,
        validFrom: input.validFrom,
        validTo: input.validTo,
    }
}

export async function findEntityAlias(
    entityId: string,
    value: string,
): Promise<GraphEntityAlias | undefined> {
    const db = await getDb()
    const normalizedValue = normalizeEntityAlias(value)
    const rows = await db
        .select({
            entityId: entityAliases.entityId,
            id: entityAliases.id,
            normalizedValue: entityAliases.normalizedValue,
            value: entityAliases.value,
        })
        .from(entityAliases)
        .where(
            and(
                eq(entityAliases.entityId, entityId),
                eq(entityAliases.normalizedValue, normalizedValue),
            ),
        )
        .limit(1)

    return rows[0]
}

export async function deleteAllExtractedGraph(): Promise<void> {
    const db = await getDb()
    await db.run(sql`
delete from relations
where exists (
    select 1 from entities e
    where (e.id = relations.subject_id or e.id = relations.object_id)
      and e.properties_json like '%"origin":"extraction"%'
);
`)
    await db.run(sql`
delete from entity_aliases
where entity_id in (
    select id from entities
    where properties_json like '%"origin":"extraction"%'
);
`)
    await db
        .delete(entities)
        .where(like(entities.propertiesJson, '%"origin":"extraction"%'))
}

export async function deleteExtractedGraphForPaths(
    paths: string[],
): Promise<void> {
    const db = await getDb()
    const uniquePaths = [...new Set(paths)].filter(Boolean)
    if (uniquePaths.length === 0) {
        return
    }
    const pathConditions = sql.join(
        uniquePaths.map(
            path =>
                sql`e.properties_json like ${`%"path":"${escapeJsonLike(path)}"%`}`,
        ),
        sql` or `,
    )

    await db.run(sql`
delete from relations
where exists (
    select 1 from entities e
    where (e.id = relations.subject_id or e.id = relations.object_id)
      and e.properties_json like '%"origin":"extraction"%'
      and (${pathConditions})
);
`)
    await db.run(sql`
delete from entity_aliases
where entity_id in (
    select e.id from entities e
    where e.properties_json like '%"origin":"extraction"%'
      and (${pathConditions})
);
`)
    await db.run(sql`
delete from entities
where properties_json like '%"origin":"extraction"%'
  and (${sql.join(
      uniquePaths.map(
          path =>
              sql`properties_json like ${`%"path":"${escapeJsonLike(path)}"%`}`,
      ),
      sql` or `,
  )});
`)
}

export async function deleteExtractedModuleGraph(): Promise<void> {
    const db = await getDb()
    await db.run(sql`
delete from relations
where exists (
    select 1 from entities e
    where (e.id = relations.subject_id or e.id = relations.object_id)
      and e.type in ('module', 'package', 'command', 'config', 'doc')
      and e.properties_json like '%"origin":"extraction"%'
);
`)
    await db.run(sql`
delete from entity_aliases
where entity_id in (
    select id from entities
    where type in ('module', 'package', 'command', 'config', 'doc')
      and properties_json like '%"origin":"extraction"%'
);
`)
    await db.run(sql`
delete from entities
where type in ('module', 'package', 'command', 'config', 'doc')
  and properties_json like '%"origin":"extraction"%';
`)
}

export function aliasesForPath(path: string): string[] {
    const normalizedPath = path.replace(/\\/gu, '/')
    const name = basename(normalizedPath)
    const extension = extname(name)
    const withoutExtension = extension ? name.slice(0, -extension.length) : name

    return [
        normalizedPath,
        name,
        withoutExtension,
        ...variantAliases(withoutExtension),
    ]
}

export function aliasesForSymbol(name: string, path: string): string[] {
    return [name, `${path}#${name}`, ...variantAliases(name)]
}

export function aliasesForPackage(name: string, manager?: string): string[] {
    const unscoped = name.startsWith('@') ? name.split('/').at(-1) : undefined
    return [
        name,
        unscoped,
        manager ? `${manager}:${name}` : undefined,
        manager ? `${manager} ${name}` : undefined,
        ...variantAliases(name),
    ].filter((value): value is string => Boolean(value))
}

export function aliasesForCommand(
    name: string,
    packageManager?: string,
): string[] {
    const manager = packageManager?.split('@')[0]
    return [
        name,
        `script ${name}`,
        `npm run ${name}`,
        manager ? `${manager} ${name}` : undefined,
        manager ? `${manager} run ${name}` : undefined,
        ...variantAliases(name),
    ].filter((value): value is string => Boolean(value))
}

export function entityIdFor(
    type: GraphEntityType,
    canonicalName: string,
): string {
    return `ent_${contentHash(`${type}:${normalizeEntityAlias(canonicalName)}`).slice(0, 32)}`
}

export function entityAliasIdFor(
    entityId: string,
    normalizedValue: string,
): string {
    return `alias_${contentHash(`${entityId}:${normalizedValue}`).slice(0, 32)}`
}

export function relationIdFor(input: GraphRelationInput): string {
    return `rel_${contentHash(
        [
            input.subjectId,
            input.predicate,
            input.objectId,
            input.evidenceKey ?? '',
        ].join(':'),
    ).slice(0, 32)}`
}

export function normalizeEntityAlias(value: string): string {
    return value
        .trim()
        .replace(/\\/gu, '/')
        .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/gu, '$1 $2')
        .toLowerCase()
        .replace(/[_-]+/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
}

function dedupeAliases(aliases: string[]): string[] {
    const seen = new Set<string>()
    const unique: string[] = []

    for (const alias of aliases) {
        const trimmed = alias.trim()
        const normalized = normalizeEntityAlias(trimmed)
        if (!trimmed || !normalized || seen.has(normalized)) {
            continue
        }
        seen.add(normalized)
        unique.push(trimmed)
    }

    return unique
}

function variantAliases(value: string): string[] {
    const normalized = normalizeEntityAlias(value)
    if (!normalized) {
        return []
    }

    return [
        normalized,
        normalized.replaceAll(' ', '-'),
        normalized.replaceAll(' ', '_'),
    ]
}

function escapeJsonLike(value: string): string {
    return JSON.stringify(value).slice(1, -1)
}

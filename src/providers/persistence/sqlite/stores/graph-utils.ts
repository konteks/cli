export type GraphPathStep = {
    depth: number
    relationId: string
    fromEntityId: string
    predicate: string
    toEntityId: string
}

export type PathRow = {
    relation_path: string
    entity_path: string
    predicate_path: string
}

export function normalizeEntityName(name: string): string {
    return name.trim().toLowerCase().replaceAll(/\s+/gu, ' ')
}

export function tokenize(query: string): string[] {
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

export function clampDepth(depth: number): number {
    return Math.max(1, Math.min(Math.trunc(depth), 5))
}

export function toPathSteps(row: PathRow): GraphPathStep[] {
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

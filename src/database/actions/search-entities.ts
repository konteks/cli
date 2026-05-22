import type EntityRecord from './_types/entity-record'
import queryEntitySearchRows, {
    type EntityRow,
} from './query-entity-search-rows'

export default async function searchEntities(
    query: string,
    options: { limit?: number } = {},
): Promise<EntityRecord[]> {
    const terms = tokenize(query)
    if (terms.length === 0) {
        return []
    }

    const rows = await queryEntitySearchRows(terms, options.limit ?? 5)
    return rows.map(entityFromRow)
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

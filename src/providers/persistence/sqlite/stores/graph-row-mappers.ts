import type {
    EntityRecord,
    EntityRow,
    HistoricalRelationRow,
} from './graph-types'

export function entityFromRow(row: EntityRow): EntityRecord {
    return {
        canonicalName: row.canonical_name,
        id: row.id,
        name: row.name,
        summary: row.summary ?? undefined,
        type: row.type,
    }
}

export function entityFromHistoricalRow(
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

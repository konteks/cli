import type {
    EntityRecord,
    HistoricalRelation,
} from '@/database/services/graph'
import queryHistoricalRelationRows, {
    type HistoricalRelationRow,
} from './query-historical-relation-rows'

export default async function historicalRelations(
    entityId: string,
    options: { limit?: number } = {},
): Promise<HistoricalRelation[]> {
    const rows = await queryHistoricalRelationRows(
        entityId,
        options.limit ?? 10,
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

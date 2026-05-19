import { randomUUID } from 'node:crypto'
import { executeSql, type SqliteExecutor } from '../libsql-helpers'
import type { RelationInput, RelationRecord } from './graph-types'

export default class GraphRelationStore {
    public constructor(private readonly client: SqliteExecutor) {}

    public async addRelation(input: RelationInput): Promise<RelationRecord> {
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
            await this.supersedeRelation(input.supersedesRelationId, now)
        }

        await executeSql(
            this.client,
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

        return relation
    }

    public async invalidateRelation(
        id: string,
        validTo?: string,
    ): Promise<void> {
        const now = new Date().toISOString()
        await executeSql(
            this.client,
            `
update relations
set status = 'invalidated', valid_to = coalesce(?, valid_to), updated_at = ?
where id = ?
`,
            [validTo ?? null, now, id],
        )
    }

    private async supersedeRelation(
        id: string,
        updatedAt: string,
    ): Promise<void> {
        await executeSql(
            this.client,
            `
update relations
set status = 'superseded', updated_at = ?
where id = ?
`,
            [updatedAt, id],
        )
    }
}

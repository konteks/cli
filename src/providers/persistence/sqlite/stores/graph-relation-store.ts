import { randomUUID } from 'node:crypto'
import type { SqliteAdapter } from '../sqlite-adapter'
import type { RelationInput, RelationRecord } from './graph-types'

export default class GraphRelationStore {
    constructor(private readonly adapter: SqliteAdapter) {}

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

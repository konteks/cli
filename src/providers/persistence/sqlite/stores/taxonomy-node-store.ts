import { randomUUID } from 'node:crypto'
import type { SqliteAdapter } from '../sqlite-adapter'
import { taxonomyNodeFromRow } from './taxonomy-row-mappers'
import type {
    TaxonomyNode,
    TaxonomyNodeInput,
    TaxonomyNodeRow,
} from './taxonomy-types'

export default class TaxonomyNodeStore {
    public constructor(private readonly adapter: SqliteAdapter) {}

    public async upsertNode(input: TaxonomyNodeInput): Promise<TaxonomyNode> {
        const existing = await this.findSiblingByName(
            input.parentId,
            input.name,
        )
        const now = new Date().toISOString()

        if (existing) {
            await this.adapter.execute(
                `
update taxonomy_nodes
set summary = coalesce(?, summary), updated_at = ?
where id = ?
`,
                [input.summary ?? null, now, existing.id],
            )
            return {
                ...existing,
                summary: input.summary ?? existing.summary,
            }
        }

        const node: TaxonomyNode = {
            id: `tax_${randomUUID()}`,
            name: input.name,
            parentId: input.parentId,
            summary: input.summary,
        }
        await this.adapter.execute(
            `
insert into taxonomy_nodes (
    id,
    parent_id,
    name,
    summary,
    created_at,
    updated_at
) values (?, ?, ?, ?, ?, ?)
`,
            [
                node.id,
                input.parentId ?? null,
                input.name,
                input.summary ?? null,
                now,
                now,
            ],
        )

        return node
    }

    private async findSiblingByName(
        parentId: string | undefined,
        name: string,
    ): Promise<TaxonomyNode | undefined> {
        const rows = await this.adapter.query<TaxonomyNodeRow>(
            `
select id, parent_id, name, summary
from taxonomy_nodes
where ${parentId ? 'parent_id = ?' : 'parent_id is null'} and lower(name) = lower(?)
limit 1
`,
            parentId ? [parentId, name] : [name],
        )

        return rows[0] ? taxonomyNodeFromRow(rows[0]) : undefined
    }
}

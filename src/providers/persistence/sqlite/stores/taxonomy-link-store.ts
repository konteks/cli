import { randomUUID } from 'node:crypto'
import type { SqliteAdapter } from '../sqlite-adapter'
import { taxonomyLinkFromRow } from './taxonomy-row-mappers'
import type {
    TaxonomyLink,
    TaxonomyLinkInput,
    TaxonomyLinkRow,
} from './taxonomy-types'

export default class TaxonomyLinkStore {
    constructor(private readonly adapter: SqliteAdapter) {}

    async linkTarget(input: TaxonomyLinkInput): Promise<TaxonomyLink> {
        const existing = await this.findLink(input)
        if (existing) {
            return existing
        }

        const link: TaxonomyLink = {
            id: `taxlink_${randomUUID()}`,
            nodeId: input.nodeId,
            targetId: input.targetId,
            targetType: input.targetType,
        }
        await this.adapter.execute(
            `
insert into taxonomy_links (
    id,
    node_id,
    target_type,
    target_id,
    created_at
) values (?, ?, ?, ?, ?)
`,
            [
                link.id,
                input.nodeId,
                input.targetType,
                input.targetId,
                new Date().toISOString(),
            ],
        )

        return link
    }

    async listLinks(nodeId: string): Promise<TaxonomyLink[]> {
        const rows = await this.adapter.query<TaxonomyLinkRow>(
            `
select id, node_id, target_type, target_id
from taxonomy_links
where node_id = ?
order by target_type, target_id
`,
            [nodeId],
        )

        return rows.map(taxonomyLinkFromRow)
    }

    private async findLink(
        input: TaxonomyLinkInput,
    ): Promise<TaxonomyLink | undefined> {
        const rows = await this.adapter.query<TaxonomyLinkRow>(
            `
select id, node_id, target_type, target_id
from taxonomy_links
where node_id = ? and target_type = ? and target_id = ?
limit 1
`,
            [input.nodeId, input.targetType, input.targetId],
        )

        return rows[0] ? taxonomyLinkFromRow(rows[0]) : undefined
    }
}

import type { TaxonomyNode } from '@/database/services/taxonomy'
import queryTaxonomyPathRows from './query-taxonomy-path-rows'

export default async function getTaxonomyPath(
    nodeId: string,
): Promise<TaxonomyNode[]> {
    const rows = await queryTaxonomyPathRows(nodeId)
    const row = rows[0]
    if (!row) {
        return []
    }

    const ids = row.id_path.split('>')
    const names = row.name_path.split('>')
    return ids.map((id, index) => ({
        id,
        name: names[index] ?? '',
    }))
}

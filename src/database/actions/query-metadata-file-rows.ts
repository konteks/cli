import { and, inArray, isNotNull, isNull } from 'drizzle-orm'
import getDb from '@/database/actions/_db'
import { sections } from '@/database/schema'

export type MetadataFileRow = {
    path: string
    source_role: string
}

const METADATA_SOURCE_ROLES = [
    'agent_config',
    'package_config',
    'product_doc',
    'tooling_config',
] as const

export default async function queryMetadataFileRows(): Promise<
    MetadataFileRow[]
> {
    const db = await getDb()
    const rows = await db
        .selectDistinct({
            path: sections.path,
            source_role: sections.sourceRole,
        })
        .from(sections)
        .where(
            and(
                isNull(sections.deletedAt),
                isNull(sections.suppressedAt),
                isNotNull(sections.path),
                inArray(sections.sourceRole, METADATA_SOURCE_ROLES),
            ),
        )
        .orderBy(sections.path)

    return rows.flatMap(row =>
        row.path && row.source_role
            ? [{ path: row.path, source_role: row.source_role }]
            : [],
    )
}

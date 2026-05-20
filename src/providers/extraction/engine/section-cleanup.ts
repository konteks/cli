import { and, eq, inArray, sql } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { deleteRetrievalDocuments } from '@/database/actions/retrieval-documents'
import { clearModules } from '@/database/actions/save-module'
import { chunks, minedSuppressions, sources } from '@/database/schema'

/**
 * Compatibility cleanup: extraction code calls these units "sections", but
 * existing storage still records them in `chunks` and related `target_type =
 * 'chunk'` rows. These deletes intentionally use the legacy storage names.
 */
export async function isExtractedSectionSuppressed(
    db: SqliteConnection,
    path: string,
    anchor: string,
    contentHashValue: string,
): Promise<boolean> {
    // "Mined" is legacy terminology; persisted compatibility keeps the table name stable.
    const rows = await db.db
        .select({ content_hash: minedSuppressions.contentHash })
        .from(minedSuppressions)
        .where(
            and(
                eq(minedSuppressions.path, path),
                eq(minedSuppressions.anchor, anchor),
                eq(minedSuppressions.contentHash, contentHashValue),
            ),
        )
        .limit(1)

    return rows.length > 0
}

export async function clearExtractedSections(
    db: SqliteConnection,
): Promise<void> {
    await recordExtractedSuppressions(db)
    await db.db.run(sql`
delete from memory_fts_indexed
where id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`)
    await db.db.run(sql`
delete from memory_fts
where id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`)
    await db.db.run(sql`
delete from taxonomy_links
where target_type = 'chunk'
  and target_id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`)
    const chunkIds = await db.db.all<{ id: string }>(sql`
select id from chunks where source_id in (select id from sources where type = 'mined_file');
`)
    await deleteRetrievalDocuments(
        db,
        'chunk',
        chunkIds.map(row => row.id),
    )
    await deleteRetrievalDocuments(db, 'module')
    await db.db.run(sql`
delete from target_embeddings
where target_type = 'chunk'
  and target_id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`)
    await db.db.run(sql`
delete from target_embeddings
where target_type = 'module';
`)
    await clearModules()
    await db.db.run(sql`
delete from chunks
where source_id in (select id from sources where type = 'mined_file');
`)
    await db.db.run(sql`
delete from sources
where type = 'mined_file';
`)
}

export async function clearExtractedSectionsForPaths(
    db: SqliteConnection,
    paths: string[],
): Promise<void> {
    const uniquePaths = [...new Set(paths)].filter(Boolean)
    if (uniquePaths.length === 0) {
        return
    }

    await recordExtractedSuppressions(db, uniquePaths)
    const chunkIds = await db.db
        .select({ id: chunks.id })
        .from(chunks)
        .where(inArray(chunks.path, uniquePaths))

    await db.db.run(sql`
delete from memory_fts_indexed
where id in (select id from chunks where path in (${sql.join(
        uniquePaths.map(path => sql`${path}`),
        sql`, `,
    )}));
`)
    await db.db.run(sql`
delete from memory_fts
where id in (select id from chunks where path in (${sql.join(
        uniquePaths.map(path => sql`${path}`),
        sql`, `,
    )}));
`)
    await db.db.run(sql`
delete from taxonomy_links
where target_type = 'chunk'
  and target_id in (select id from chunks where path in (${sql.join(
      uniquePaths.map(path => sql`${path}`),
      sql`, `,
  )}));
`)
    await deleteRetrievalDocuments(
        db,
        'chunk',
        chunkIds.map(row => row.id),
    )
    await db.db.run(sql`
delete from target_embeddings
where target_type = 'chunk'
  and target_id in (select id from chunks where path in (${sql.join(
      uniquePaths.map(path => sql`${path}`),
      sql`, `,
  )}));
`)
    await db.db.delete(chunks).where(inArray(chunks.path, uniquePaths))
    await db.db
        .delete(sources)
        .where(
            and(
                eq(sources.type, 'mined_file'),
                inArray(sources.uri, uniquePaths),
            ),
        )
}

async function recordExtractedSuppressions(
    db: SqliteConnection,
    paths?: string[],
): Promise<void> {
    await db.db.run(sql`
insert or ignore into mined_suppressions (
    path,
    anchor,
    content_hash,
    reason,
    created_at
)
select
    path,
    coalesce(anchor, ''),
    content_hash,
    forget_reason,
    coalesce(suppressed_at, deleted_at, updated_at)
from chunks
where (suppressed_at is not null or deleted_at is not null)
  and path is not null
  ${
      paths && paths.length > 0
          ? sql`and path in (${sql.join(
                paths.map(path => sql`${path}`),
                sql`, `,
            )})`
          : sql``
  };
`)
}

import { clearModules } from '@/database/actions/save-module'
import type { SqliteConnection } from '@/providers/persistence/sqlite/database'
import {
    executeSql,
    querySql,
} from '@/providers/persistence/sqlite/libsql-helpers'
import { deleteRetrievalDocuments } from '@/providers/persistence/sqlite/retrieval-documents'

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
    const rows = await querySql<{ content_hash: string }>(
        db.client,
        `
select content_hash
from mined_suppressions
where path = ?
  and anchor = ?
  and content_hash = ?
limit 1
`,
        [path, anchor, contentHashValue],
    )

    return rows.length > 0
}

export async function clearExtractedSections(
    db: SqliteConnection,
): Promise<void> {
    await recordExtractedSuppressions(db)
    await executeSql(
        db.client,
        `
delete from memory_fts_indexed
where id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`,
    )
    await executeSql(
        db.client,
        `
delete from memory_fts
where id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`,
    )
    await executeSql(
        db.client,
        `
delete from taxonomy_links
where target_type = 'chunk'
  and target_id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`,
    )
    const chunkIds = await querySql<{ id: string }>(
        db.client,
        `
select id from chunks where source_id in (select id from sources where type = 'mined_file');
`,
    )
    await deleteRetrievalDocuments(
        db,
        'chunk',
        chunkIds.map(row => row.id),
    )
    await deleteRetrievalDocuments(db, 'module')
    await executeSql(
        db.client,
        `
delete from target_embeddings
where target_type = 'chunk'
  and target_id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`,
    )
    await executeSql(
        db.client,
        `
delete from target_embeddings
where target_type = 'module';
`,
    )
    await clearModules()
    await executeSql(
        db.client,
        `
delete from chunks
where source_id in (select id from sources where type = 'mined_file');
`,
    )
    await executeSql(
        db.client,
        `
delete from sources
where type = 'mined_file';
`,
    )
}

export async function clearExtractedSectionsForPaths(
    db: SqliteConnection,
    paths: string[],
): Promise<void> {
    const uniquePaths = [...new Set(paths)].filter(Boolean)
    if (uniquePaths.length === 0) {
        return
    }

    const placeholders = uniquePaths.map(() => '?').join(', ')

    await recordExtractedSuppressions(db, uniquePaths)
    const chunkIds = await querySql<{ id: string }>(
        db.client,
        `
select id
from chunks
where path in (${placeholders});
`,
        uniquePaths,
    )

    await executeSql(
        db.client,
        `
delete from memory_fts_indexed
where id in (
    select id
    from chunks
    where path in (${placeholders})
);
`,
        uniquePaths,
    )
    await executeSql(
        db.client,
        `
delete from memory_fts
where id in (
    select id
    from chunks
    where path in (${placeholders})
);
`,
        uniquePaths,
    )
    await executeSql(
        db.client,
        `
delete from taxonomy_links
where target_type = 'chunk'
  and target_id in (
    select id
    from chunks
    where path in (${placeholders})
);
`,
        uniquePaths,
    )
    await deleteRetrievalDocuments(
        db,
        'chunk',
        chunkIds.map(row => row.id),
    )
    await executeSql(
        db.client,
        `
delete from target_embeddings
where target_type = 'chunk'
  and target_id in (
    select id
    from chunks
    where path in (${placeholders})
);
`,
        uniquePaths,
    )
    await executeSql(
        db.client,
        `
delete from chunks
where path in (${placeholders});
`,
        uniquePaths,
    )
    await executeSql(
        db.client,
        `
delete from sources
where type = 'mined_file'
  and uri in (${placeholders});
`,
        uniquePaths,
    )
}

async function recordExtractedSuppressions(
    db: SqliteConnection,
    paths?: string[],
): Promise<void> {
    const pathFilter =
        paths && paths.length > 0
            ? `and path in (${paths.map(() => '?').join(', ')})`
            : ''
    await executeSql(
        db.client,
        `
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
  ${pathFilter};
`,
        paths ?? [],
    )
}

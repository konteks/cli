import type { DatabaseService } from '@/providers/persistence/sqlite/db'
import { deleteRetrievalDocuments } from '@/providers/persistence/sqlite/retrieval-documents'

export async function isMinedChunkSuppressed(
    db: DatabaseService,
    path: string,
    anchor: string,
    contentHashValue: string,
): Promise<boolean> {
    const rows = await db.adapter.query<{ content_hash: string }>(
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

export async function clearMinedChunks(db: DatabaseService): Promise<void> {
    const adapter = db.adapter
    await recordMinedSuppressions(db)
    await adapter.execute(`
delete from memory_fts_indexed
where id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`)
    await adapter.execute(`
delete from memory_fts
where id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`)
    await adapter.execute(`
delete from taxonomy_links
where target_type = 'chunk'
  and target_id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`)
    const chunkIds = await adapter.query<{ id: string }>(`
select id from chunks where source_id in (select id from sources where type = 'mined_file');
`)
    await deleteRetrievalDocuments(
        db,
        'chunk',
        chunkIds.map(row => row.id),
    )
    await deleteRetrievalDocuments(db, 'module')
    await adapter.execute(`
delete from target_embeddings
where target_type = 'chunk'
  and target_id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`)
    await adapter.execute(`
delete from target_embeddings
where target_type = 'module';
`)
    await db.modules.clear()
    await adapter.execute(`
delete from chunks
where source_id in (select id from sources where type = 'mined_file');
`)
    await adapter.execute(`
delete from sources
where type = 'mined_file';
`)
}

export async function clearMinedChunksForPaths(
    db: DatabaseService,
    paths: string[],
): Promise<void> {
    const adapter = db.adapter
    const uniquePaths = [...new Set(paths)].filter(Boolean)
    if (uniquePaths.length === 0) {
        return
    }

    const placeholders = uniquePaths.map(() => '?').join(', ')

    await recordMinedSuppressions(db, uniquePaths)
    const chunkIds = await adapter.query<{ id: string }>(
        `
select id
from chunks
where path in (${placeholders});
`,
        uniquePaths,
    )

    await adapter.execute(
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
    await adapter.execute(
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
    await adapter.execute(
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
    await adapter.execute(
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
    await adapter.execute(
        `
delete from chunks
where path in (${placeholders});
`,
        uniquePaths,
    )
    await adapter.execute(
        `
delete from sources
where type = 'mined_file'
  and uri in (${placeholders});
`,
        uniquePaths,
    )
}

async function recordMinedSuppressions(
    db: DatabaseService,
    paths?: string[],
): Promise<void> {
    const pathFilter =
        paths && paths.length > 0
            ? `and path in (${paths.map(() => '?').join(', ')})`
            : ''
    await db.adapter.execute(
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

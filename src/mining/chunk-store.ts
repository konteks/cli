import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { indexSearchDocument } from '../memory/search-index.js'
import { TaxonomyStore } from '../memory/taxonomy-store.js'
import type { LoadedProjectContext } from '../project/context.js'
import { contentHash } from '../storage/content.js'
import { appendMemoryEvent } from '../storage/event-log.js'
import { storePayload } from '../storage/payload.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import { createToonStore } from '../storage/toon-store.js'
import { chunkFile } from './chunking.js'
import type { ScannedFile } from './file-scan.js'

type MineChunksResult = {
    chunkCount: number
}

export async function mineChunks(
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    files: ScannedFile[],
    minedAt: string,
): Promise<MineChunksResult> {
    const toonStore = createToonStore(context.memoryDir)
    const taxonomy = new TaxonomyStore(adapter)
    let chunkCount = 0

    await adapter.transaction(async () => {
        await clearMinedChunks(adapter)
        const rootNode = await taxonomy.upsertNode({
            name: 'Project Files',
            summary: 'Files mined from the current project.',
        })

        for (const file of files) {
            const content = await readFile(
                join(context.projectRoot, file.path),
                'utf8',
            )
            const chunks = chunkFile(file, content)
            if (chunks.length === 0) {
                continue
            }

            const sourceId = sourceIdForPath(file.path)
            await adapter.execute(
                `
insert into sources (id, type, uri, excerpt_ref, created_at)
values (?, ?, ?, ?, ?)
`,
                [sourceId, 'mined_file', file.path, null, minedAt],
            )
            const taxonomyNode = await ensurePathTaxonomy(
                taxonomy,
                rootNode.id,
                file.path,
            )

            for (const [index, chunk] of chunks.entries()) {
                const stored = await storePayload(chunk.content, {
                    inlineMaxBytes:
                        context.config.storage.inlinePayloadMaxBytes,
                    toonStore,
                })
                const chunkId = chunkIdFor(file.path, index, stored.contentHash)
                await adapter.execute(
                    `
insert into chunks (
    id,
    source_id,
    kind,
    path,
    symbol,
    summary,
    content_inline,
    payload_ref,
    content_hash,
    token_count,
    created_at,
    updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
                    [
                        chunkId,
                        sourceId,
                        chunk.kind,
                        chunk.path,
                        chunk.symbol ?? null,
                        chunk.summary,
                        stored.contentInline ?? null,
                        stored.payloadRef ?? null,
                        stored.contentHash,
                        stored.tokenCount,
                        minedAt,
                        minedAt,
                    ],
                )
                await taxonomy.linkTarget({
                    nodeId: taxonomyNode.id,
                    targetId: chunkId,
                    targetType: 'chunk',
                })
                await indexSearchDocument(adapter, {
                    content: stored.contentInline ?? chunk.summary,
                    createdAt: minedAt,
                    id: chunkId,
                    kind: chunk.kind,
                    task: chunk.path,
                    type: 'chunk',
                })
                chunkCount += 1
            }
        }

        await appendMemoryEvent(adapter, {
            actor: 'cli',
            eventType: 'project_mined',
            id: `event_${contentHash(`${context.projectRoot}:${minedAt}`).slice(0, 32)}`,
            subjectType: 'project',
            summary: `Mined ${files.length} files into ${chunkCount} chunks.`,
        })
    })

    return { chunkCount }
}

async function clearMinedChunks(adapter: SqliteAdapter): Promise<void> {
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
    await adapter.execute(`
delete from chunks
where source_id in (select id from sources where type = 'mined_file');
`)
    await adapter.execute(`
delete from sources
where type = 'mined_file';
`)
}

async function ensurePathTaxonomy(
    taxonomy: TaxonomyStore,
    rootNodeId: string,
    path: string,
) {
    const parts = path.split('/')
    const directories = parts.slice(0, -1)
    let parentId = rootNodeId

    for (const directory of directories) {
        const node = await taxonomy.upsertNode({
            name: directory,
            parentId,
        })
        parentId = node.id
    }

    return taxonomy.upsertNode({
        name: parts.at(-1) ?? path,
        parentId,
    })
}

function sourceIdForPath(path: string): string {
    return `source_${contentHash(path).slice(0, 32)}`
}

function chunkIdFor(path: string, index: number, hash: string): string {
    return `chunk_${contentHash(`${path}:${index}:${hash}`).slice(0, 32)}`
}

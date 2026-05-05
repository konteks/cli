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
import {
    classifySourceRole,
    detectLanguage,
    extractTopics,
} from './classification.js'
import type { ScannedFile } from './file-scan.js'
import { initTreeSitterWithBundledGrammars } from './grammar-loader.js'
import type { ProjectMetadata } from './metadata.js'
import { rebuildModuleArtifacts } from './module-store.js'
import type { MineProgressReporter } from './progress.js'
import {
    buildChunkRetrievalTexts,
    deleteRetrievalDocuments,
    reindexRetrievalDocumentFts,
    upsertRetrievalDocument,
} from './retrieval-documents.js'
import type { CodeMetadata } from './tree-sitter-engine.js'
import { TreeSitterEngine } from './tree-sitter-engine.js'

type MineChunksResult = {
    chunkCount: number
    filesTruncatedByChunkLimit: number
    parserFallbackFiles: number
    parserUsedFiles: number
}

type PreparedChunk = {
    anchor: string
    anchorType: string
    contentInline?: string
    contentHash: string
    endLine?: number
    heading?: string
    id: string
    jsonPath?: string
    kind: string
    metadata: Record<string, unknown>
    path: string
    payloadRef?: string
    retrievalTexts: {
        embeddingText: string
        ftsText: string
    }
    startLine?: number
    summary: string
    symbol?: string
    tokenCount: number
    topics: string[]
}

type PreparedFile = {
    chunks: PreparedChunk[]
    language: string
    parserEngine: string
    parserStatus: string
    path: string
    sourceId: string
    sourceMetadata: Record<string, unknown>
    sourceRole: string
    sourceTopics: string[]
    truncated: boolean
}

const defaultMaxChunksPerFile = 200

export async function mineChunks(
    adapter: SqliteAdapter,
    context: LoadedProjectContext,
    files: ScannedFile[],
    minedAt: string,
    options: {
        deletedPaths?: string[]
        metadata?: ProjectMetadata
        mode?: 'changed' | 'full' | 'reindex'
        onProgress?: MineProgressReporter
        treeSitterEngine?: TreeSitterEngine
    } = {},
): Promise<MineChunksResult> {
    const progress = options.onProgress
    const toonStore = createToonStore(context.memoryDir)
    const taxonomy = new TaxonomyStore(adapter)
    let engine: TreeSitterEngine | undefined
    progress?.({
        message: 'Loading Tree-sitter grammars',
        phase: 'chunks',
        status: 'start',
    })
    try {
        engine = options.treeSitterEngine ?? new TreeSitterEngine()
        await initTreeSitterWithBundledGrammars(engine)
        progress?.({
            message: 'Tree-sitter grammars ready',
            phase: 'chunks',
            status: 'progress',
        })
    } catch (error) {
        console.error(
            'Tree-sitter initialization failed, using heuristic chunking fallback:',
            error,
        )
        engine = undefined
        progress?.({
            message: 'Tree-sitter unavailable; using heuristic fallback',
            phase: 'chunks',
            status: 'progress',
        })
    }

    let chunkCount = 0
    let filesTruncatedByChunkLimit = 0
    let parserFallbackFiles = 0
    let parserUsedFiles = 0

    let rootNodeId = ''
    progress?.({
        message: 'Preparing extraction tables',
        phase: 'database',
        status: 'progress',
    })
    await adapter.transaction(async () => {
        if (options.mode === 'changed') {
            await clearMinedChunksForPaths(adapter, [
                ...files.map(file => file.path),
                ...(options.deletedPaths ?? []),
            ])
        } else {
            await clearMinedChunks(adapter)
        }
        const rootNode = await taxonomy.upsertNode({
            name: 'Project Files',
            summary: 'Files extracted from the current project.',
        })
        rootNodeId = rootNode.id
    })

    progress?.({
        message: `Extracting ${files.length} files`,
        phase: 'chunks',
        status: 'start',
        total: files.length,
    })
    for (const [fileIndex, file] of files.entries()) {
        const preparedFile = await prepareFileChunks({
            adapter,
            context,
            engine,
            file,
            toonStore,
        })

        if (
            preparedFile.parserEngine === 'tree_sitter' &&
            preparedFile.parserStatus === 'ok'
        ) {
            parserUsedFiles += 1
        } else if (preparedFile.chunks.some(chunk => chunk.kind === 'code')) {
            parserFallbackFiles += 1
        }

        if (preparedFile.truncated) {
            filesTruncatedByChunkLimit += 1
        }
        if (preparedFile.chunks.length === 0) {
            continue
        }

        await adapter.transaction(async () => {
            await adapter.execute(
                `
insert into sources (
    id,
    type,
    uri,
    excerpt_ref,
    created_at,
    source_role,
    language,
    topics_json,
    entities_json,
    metadata_json
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
                [
                    preparedFile.sourceId,
                    'mined_file',
                    preparedFile.path,
                    null,
                    minedAt,
                    preparedFile.sourceRole,
                    preparedFile.language,
                    JSON.stringify(preparedFile.sourceTopics),
                    JSON.stringify([]),
                    JSON.stringify(preparedFile.sourceMetadata),
                ],
            )
            const taxonomyNode = await ensurePathTaxonomy(
                taxonomy,
                rootNodeId,
                preparedFile.path,
            )

            for (const chunk of preparedFile.chunks) {
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
    updated_at,
    source_role,
    language,
    anchor_type,
    anchor,
    heading,
    json_path,
    topics_json,
    entities_json,
    metadata_json,
    start_line,
    end_line
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
                    [
                        chunk.id,
                        preparedFile.sourceId,
                        chunk.kind,
                        chunk.path,
                        chunk.symbol ?? null,
                        chunk.summary,
                        chunk.contentInline ?? null,
                        chunk.payloadRef ?? null,
                        chunk.contentHash,
                        chunk.tokenCount,
                        minedAt,
                        minedAt,
                        preparedFile.sourceRole,
                        preparedFile.language,
                        chunk.anchorType,
                        chunk.anchor,
                        chunk.heading ?? null,
                        chunk.jsonPath ?? null,
                        JSON.stringify(chunk.topics),
                        JSON.stringify([]),
                        JSON.stringify(chunk.metadata ?? {}),
                        chunk.startLine ?? null,
                        chunk.endLine ?? null,
                    ],
                )
                await taxonomy.linkTarget({
                    nodeId: taxonomyNode.id,
                    targetId: chunk.id,
                    targetType: 'chunk',
                })
                await indexSearchDocument(adapter, {
                    content: chunk.contentInline ?? chunk.summary,
                    createdAt: minedAt,
                    id: chunk.id,
                    kind: chunk.kind,
                    task: chunk.path,
                    type: 'chunk',
                })
                await upsertRetrievalDocument(adapter, {
                    anchor: chunk.anchor,
                    embeddingText: chunk.retrievalTexts.embeddingText,
                    ftsText: chunk.retrievalTexts.ftsText,
                    path: chunk.path,
                    sourceId: preparedFile.sourceId,
                    sourceRole: preparedFile.sourceRole,
                    summary: chunk.summary,
                    targetId: chunk.id,
                    targetType: 'chunk',
                    updatedAt: minedAt,
                })
                chunkCount += 1
            }
        })
        progress?.({
            chunkCount,
            current: fileIndex + 1,
            message: `Extracted ${file.path} (${preparedFile.chunks.length} sections)`,
            path: file.path,
            phase: 'chunks',
            status: 'progress',
            total: files.length,
        })
    }

    progress?.({
        chunkCount,
        message: `Extracted ${chunkCount} sections`,
        phase: 'chunks',
        status: 'done',
        total: files.length,
    })
    progress?.({
        message: 'Rebuilding module artifacts and retrieval index',
        phase: 'modules',
        status: 'start',
    })
    await adapter.transaction(async () => {
        await rebuildModuleArtifacts(adapter, minedAt, options.metadata)
        await reindexRetrievalDocumentFts(adapter)

        await appendMemoryEvent(adapter, {
            actor: 'cli',
            eventType: 'project_mined',
            id: `event_${contentHash(`${context.projectRoot}:${minedAt}`).slice(0, 32)}`,
            subjectType: 'project',
            summary: `Extracted ${files.length} files into ${chunkCount} sections.`,
        })
    })
    progress?.({
        message: 'Module artifacts and retrieval index ready',
        phase: 'modules',
        status: 'done',
    })

    return {
        chunkCount,
        filesTruncatedByChunkLimit,
        parserFallbackFiles,
        parserUsedFiles,
    }
}

async function prepareFileChunks(input: {
    adapter: SqliteAdapter
    context: LoadedProjectContext
    engine?: TreeSitterEngine
    file: ScannedFile
    toonStore: ReturnType<typeof createToonStore>
}): Promise<PreparedFile> {
    const content = await readFile(
        join(input.context.projectRoot, input.file.path),
        'utf8',
    )
    const sourceRole = classifySourceRole(input.file.path)
    const language = detectLanguage(input.file.path)
    let parserEngine = 'heuristic'
    let parserStatus = 'not_applicable'
    let parsedMetadata: CodeMetadata | undefined

    if (input.engine && isTreeSitterLanguage(language)) {
        parserEngine = 'tree_sitter'
        try {
            parsedMetadata = await input.engine.parse(input.file.path, content)
            parserStatus = parsedMetadata ? 'ok' : 'unavailable'
        } catch (error) {
            parserStatus = 'failed'
            console.error(
                `Tree-sitter parse failed for ${input.file.path}, falling back to heuristic chunking:`,
                error,
            )
        }
    }

    const allChunks = await chunkFile(
        input.file,
        content,
        input.engine,
        parsedMetadata,
    )
    const chunks = allChunks
        .map(chunk => ({
            ...chunk,
            metadata: {
                parserEngine,
                parserStatus,
                ...chunk.metadata,
            },
        }))
        .slice(0, defaultMaxChunksPerFile)

    const sourceTopics = extractTopics(
        input.file.path,
        chunks.map(chunk => chunk.summary).join('\n'),
    )
    const preparedChunks: PreparedChunk[] = []

    for (const [index, chunk] of chunks.entries()) {
        const stored = await storePayload(chunk.content, {
            inlineMaxBytes: input.context.config.storage.inlinePayloadMaxBytes,
            toonStore: input.toonStore,
        })
        if (
            await isMinedChunkSuppressed(
                input.adapter,
                input.file.path,
                chunk.anchor,
                stored.contentHash,
            )
        ) {
            continue
        }

        const topics = extractTopics(
            `${input.file.path} ${chunk.anchor}`,
            `${chunk.summary}\n${chunk.content}`,
        )
        preparedChunks.push({
            anchor: chunk.anchor,
            anchorType: chunk.anchorType,
            contentHash: stored.contentHash,
            contentInline: stored.contentInline,
            endLine: chunk.endLine,
            heading: chunk.heading,
            id: chunkIdFor(
                input.file.path,
                index,
                chunk.anchor,
                stored.contentHash,
            ),
            jsonPath: chunk.jsonPath,
            kind: chunk.kind,
            metadata: chunk.metadata ?? {},
            path: chunk.path,
            payloadRef: stored.payloadRef,
            retrievalTexts: buildChunkRetrievalTexts({
                anchor: chunk.anchor,
                content: chunk.content,
                language,
                path: chunk.path,
                sourceRole,
                summary: chunk.summary,
                topics,
            }),
            startLine: chunk.startLine,
            summary: chunk.summary,
            symbol: chunk.symbol,
            tokenCount: stored.tokenCount,
            topics,
        })
    }

    return {
        chunks: preparedChunks,
        language,
        parserEngine,
        parserStatus,
        path: input.file.path,
        sourceId: sourceIdForPath(input.file.path),
        sourceMetadata: {
            exports: parsedMetadata?.exports ?? [],
            imports: parsedMetadata?.imports ?? [],
            parserEngine,
            parserStatus,
        },
        sourceRole,
        sourceTopics,
        truncated: allChunks.length > chunks.length,
    }
}

async function isMinedChunkSuppressed(
    adapter: SqliteAdapter,
    path: string,
    anchor: string,
    contentHashValue: string,
): Promise<boolean> {
    const rows = await adapter.query<{ content_hash: string }>(
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

async function clearMinedChunks(adapter: SqliteAdapter): Promise<void> {
    await recordMinedSuppressions(adapter)
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
        adapter,
        'chunk',
        chunkIds.map(row => row.id),
    )
    await deleteRetrievalDocuments(adapter, 'module')
    await adapter.execute(`
delete from target_embeddings
where target_type = 'chunk'
  and target_id in (select id from chunks where source_id in (select id from sources where type = 'mined_file'));
`)
    await adapter.execute(`
delete from target_embeddings
where target_type = 'module';
`)
    await adapter.execute('delete from modules')
    await adapter.execute(`
delete from chunks
where source_id in (select id from sources where type = 'mined_file');
`)
    await adapter.execute(`
delete from sources
where type = 'mined_file';
`)
}

async function clearMinedChunksForPaths(
    adapter: SqliteAdapter,
    paths: string[],
): Promise<void> {
    const uniquePaths = [...new Set(paths)].filter(Boolean)
    if (uniquePaths.length === 0) {
        return
    }

    const placeholders = uniquePaths.map(() => '?').join(', ')

    await recordMinedSuppressions(adapter, uniquePaths)
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
        adapter,
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
    adapter: SqliteAdapter,
    paths?: string[],
): Promise<void> {
    const pathFilter =
        paths && paths.length > 0
            ? `and path in (${paths.map(() => '?').join(', ')})`
            : ''
    await adapter.execute(
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

function chunkIdFor(
    path: string,
    index: number,
    anchor: string,
    hash: string,
): string {
    return `chunk_${contentHash(`${path}:${index}:${anchor}:${hash}`).slice(0, 32)}`
}

function isTreeSitterLanguage(language: string): boolean {
    return (
        language === 'html' ||
        language === 'javascript' ||
        language === 'jsdoc' ||
        language === 'json' ||
        language === 'php' ||
        language === 'typescript' ||
        language === 'tsx'
    )
}

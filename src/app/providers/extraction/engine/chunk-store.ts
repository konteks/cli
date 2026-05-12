import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MineProgressReporter } from '@/app/contracts/services/progress'
import type { Project } from '@/app/models/project'
import { contentHash } from '@/app/providers/persistence/objects/content'
import { storePayload } from '@/app/providers/persistence/objects/payload'
import { createToonStore } from '@/app/providers/persistence/objects/toon-store'
import type { DatabaseService } from '@/app/providers/persistence/sqlite/db'
import {
    buildChunkRetrievalTexts,
    reindexRetrievalDocumentFts,
    upsertRetrievalDocument,
} from '@/app/providers/persistence/sqlite/retrieval-documents'
import { indexSearchDocument } from '@/app/providers/persistence/sqlite/search-index'
import type { TaxonomyStore } from '@/app/providers/persistence/sqlite/stores/taxonomy-store'
import {
    classifySourceRole,
    detectLanguage,
    extractTopics,
} from '@/app/providers/project/source-classification'
import { terminal } from '@/support/terminal/service'
import {
    clearMinedChunks,
    clearMinedChunksForPaths,
    isMinedChunkSuppressed,
} from './chunk-cleanup'
import { chunkFile } from './chunking'
import type { ScannedFile } from './file-scan'
import { initTreeSitterWithBundledGrammars } from './grammar-loader'
import type { ProjectMetadata } from './metadata'
import { rebuildModuleArtifacts } from './module-store'
import type { CodeMetadata } from './tree-sitter-engine'
import { TreeSitterEngine } from './tree-sitter-engine'

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
    db: DatabaseService,
    context: Project,
    files: ScannedFile[],
    minedAt: string,
    options: {
        deletedPaths?: string[]
        metadata?: ProjectMetadata
        mode?: 'changed' | 'full' | 'reindex' | 'resume'
        onProgress?: MineProgressReporter
        treeSitterEngine?: TreeSitterEngine
    } = {},
): Promise<MineChunksResult> {
    const progress = options.onProgress
    const toonStore = createToonStore(context.memoryDir)
    const taxonomy = db.taxonomy
    let engine: TreeSitterEngine | undefined

    if (files.length > 0) {
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
            terminal.error(
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
    await db.transaction(async tx => {
        if (options.mode === 'changed') {
            await clearMinedChunksForPaths(tx, [
                ...files.map(file => file.path),
                ...(options.deletedPaths ?? []),
            ])
        } else if (options.mode !== 'resume') {
            await clearMinedChunks(tx)
        }
        const rootNode = await taxonomy.upsertNode({
            name: 'Project Files',
            summary: 'Files extracted from the current project.',
        })
        rootNodeId = rootNode.id
    })

    if (files.length > 0) {
        progress?.({
            message: `Extracting ${files.length} files`,
            phase: 'chunks',
            status: 'start',
            total: files.length,
        })
    }
    for (const [fileIndex, file] of files.entries()) {
        const preparedFile = await prepareFileChunks({
            context,
            db,
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

        await db.transaction(async tx => {
            await tx.sources.insert({
                entities_json: JSON.stringify([]),
                excerpt_ref: null,
                id: preparedFile.sourceId,
                language: preparedFile.language,
                metadata_json: JSON.stringify(preparedFile.sourceMetadata),
                source_role: preparedFile.sourceRole,
                topics_json: JSON.stringify(preparedFile.sourceTopics),
                type: 'mined_file',
                uri: preparedFile.path,
            })

            const taxonomyNode = await ensurePathTaxonomy(
                taxonomy,
                rootNodeId,
                preparedFile.path,
            )

            for (const chunk of preparedFile.chunks) {
                await db.chunks.insert({
                    anchor: chunk.anchor,
                    anchor_type: chunk.anchorType,
                    content_hash: chunk.contentHash,
                    content_inline: chunk.contentInline ?? null,
                    end_line: chunk.endLine ?? null,
                    entities_json: JSON.stringify([]),
                    heading: chunk.heading ?? null,
                    id: chunk.id,
                    json_path: chunk.jsonPath ?? null,
                    kind: chunk.kind,
                    language: preparedFile.language,
                    metadata_json: JSON.stringify(chunk.metadata ?? {}),
                    path: chunk.path,
                    payload_ref: chunk.payloadRef ?? null,
                    source_id: preparedFile.sourceId,
                    source_role: preparedFile.sourceRole,
                    start_line: chunk.startLine ?? null,
                    summary: chunk.summary,
                    symbol: chunk.symbol ?? null,
                    token_count: chunk.tokenCount,
                    topics_json: JSON.stringify(chunk.topics),
                })

                await taxonomy.linkTarget({
                    nodeId: taxonomyNode.id,
                    targetId: chunk.id,
                    targetType: 'chunk',
                })
                await indexSearchDocument(db.adapter, {
                    content: chunk.contentInline ?? chunk.summary,
                    createdAt: minedAt,
                    id: chunk.id,
                    kind: chunk.kind,
                    task: chunk.path,
                    type: 'chunk',
                })
                await upsertRetrievalDocument(db, {
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

    if (files.length > 0) {
        progress?.({
            chunkCount,
            message: `Extracted ${chunkCount} sections`,
            phase: 'chunks',
            status: 'done',
            total: files.length,
        })
    }
    progress?.({
        message: 'Rebuilding module artifacts and retrieval index',
        phase: 'modules',
        status: 'start',
    })
    await db.transaction(async tx => {
        await rebuildModuleArtifacts(tx, minedAt, options.metadata)
        await reindexRetrievalDocumentFts(tx)

        await tx.events.append({
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
    db: DatabaseService
    context: Project
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
            terminal.error(
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
                input.db,
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

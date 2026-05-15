import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Project } from '@/models/project'
import { contentHash } from '@/providers/persistence/objects/content'
import { storePayload } from '@/providers/persistence/objects/payload'
import type { createToonStore } from '@/providers/persistence/objects/toon-store'
import type { DatabaseService } from '@/providers/persistence/sqlite/db'
import { buildChunkRetrievalTexts } from '@/providers/persistence/sqlite/retrieval-documents'
import {
    classifySourceRole,
    detectLanguage,
    extractTopics,
} from '@/providers/project/source-classification'
import { isExtractedChunkSuppressed } from './chunk-cleanup'
import { chunkFile } from './chunking'
import type { ScannedFile } from './file-scan'
import { getGrammarForPath } from './grammar-loader'
import type { CodeMetadata, TreeSitterEngine } from './tree-sitter-engine'

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

export type PreparedFile = {
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

export async function prepareFileChunks(input: {
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
    const grammar = getGrammarForPath(input.file.path)

    if (grammar) {
        if (!input.engine?.hasLanguage(grammar.id)) {
            throw new Error(
                `Tree-sitter grammar "${grammar.id}" is required for ${input.file.path}. Select and cache the ${grammar.displayName} grammar before extraction.`,
            )
        }

        parserEngine = 'tree_sitter'
        parsedMetadata = await input.engine.parse(input.file.path, content)
        parserStatus = parsedMetadata ? 'ok' : 'unavailable'
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
            await isExtractedChunkSuppressed(
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

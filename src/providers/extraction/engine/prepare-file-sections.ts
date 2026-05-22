import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildSectionRetrievalTexts } from '@/database/support/retrieval-texts'
import { contentHash } from '@/providers/persistence/objects/content'
import type createToonStore from '@/providers/persistence/objects/create-toon-store'
import storePayload from '@/providers/persistence/objects/store-payload'
import {
    classifySourceRole,
    detectLanguage,
    extractTopics,
} from '@/providers/project/source-classification'
import type { Project } from '@/types/project'
import type { ScannedFile } from './file-scan'
import { getGrammarForPath, isBundledGrammar } from './grammar-loader'
import { isExtractedSectionSuppressed } from './section-cleanup'
import sectionFile from './section-file'
import type TreeSitterEngine from './tree-sitter-engine'
import type { CodeMetadata } from './tree-sitter-engine'

type PreparedSection = {
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
    sections: PreparedSection[]
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

const defaultMaxSectionsPerFile = 200

export default async function prepareFileSections(input: {
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
        if (
            !isBundledGrammar(grammar.id) &&
            !input.context.config.extraction.grammars.selected.includes(
                grammar.id,
            )
        ) {
            return emptyPreparedFile({
                file: input.file,
                language,
                parserEngine,
                parserStatus: 'skipped_unselected_grammar',
                sourceRole,
            })
        }

        if (!input.engine?.hasLanguage(grammar.id)) {
            const action = isBundledGrammar(grammar.id)
                ? `Bundled ${grammar.displayName} grammar was not loaded before extraction.`
                : `Select and cache the ${grammar.displayName} grammar before extraction.`
            throw new Error(
                `Tree-sitter grammar "${grammar.id}" is required for ${input.file.path}. ${action}`,
            )
        }

        parserEngine = 'tree_sitter'
        parsedMetadata = await input.engine.parse(input.file.path, content)
        parserStatus = parsedMetadata ? 'ok' : 'unavailable'
    }

    const allSections = await sectionFile(
        input.file,
        content,
        input.engine,
        parsedMetadata,
    )
    const sections = allSections
        .map(section => ({
            ...section,
            metadata: {
                parserEngine,
                parserStatus,
                ...section.metadata,
            },
        }))
        .slice(0, defaultMaxSectionsPerFile)

    const sourceTopics = extractTopics(
        input.file.path,
        sections.map(section => section.summary).join('\n'),
    )
    const preparedSections: PreparedSection[] = []

    for (const [index, section] of sections.entries()) {
        const stored = await storePayload(section.content, {
            inlineMaxBytes: input.context.config.storage.inlinePayloadMaxBytes,
            toonStore: input.toonStore,
        })
        if (
            await isExtractedSectionSuppressed(
                input.file.path,
                section.anchor,
                stored.contentHash,
            )
        ) {
            continue
        }

        const topics = extractTopics(
            `${input.file.path} ${section.anchor}`,
            `${section.summary}\n${section.content}`,
        )
        preparedSections.push({
            anchor: section.anchor,
            anchorType: section.anchorType,
            contentHash: stored.contentHash,
            contentInline: stored.contentInline,
            endLine: section.endLine,
            heading: section.heading,
            id: sectionIdFor(
                input.file.path,
                index,
                section.anchor,
                stored.contentHash,
            ),
            jsonPath: section.jsonPath,
            kind: section.kind,
            metadata: section.metadata ?? {},
            path: section.path,
            payloadRef: stored.payloadRef,
            retrievalTexts: buildSectionRetrievalTexts({
                anchor: section.anchor,
                content: section.content,
                language,
                path: section.path,
                sourceRole,
                summary: section.summary,
                topics,
            }),
            startLine: section.startLine,
            summary: section.summary,
            symbol: section.symbol,
            tokenCount: stored.tokenCount,
            topics,
        })
    }

    return {
        language,
        parserEngine,
        parserStatus,
        path: input.file.path,
        sections: preparedSections,
        sourceId: sourceIdForPath(input.file.path),
        sourceMetadata: {
            exports: parsedMetadata?.exports ?? [],
            imports: parsedMetadata?.imports ?? [],
            parserEngine,
            parserStatus,
        },
        sourceRole,
        sourceTopics,
        truncated: allSections.length > sections.length,
    }
}

function emptyPreparedFile(input: {
    file: ScannedFile
    language: string
    parserEngine: string
    parserStatus: string
    sourceRole: string
}): PreparedFile {
    return {
        language: input.language,
        parserEngine: input.parserEngine,
        parserStatus: input.parserStatus,
        path: input.file.path,
        sections: [],
        sourceId: sourceIdForPath(input.file.path),
        sourceMetadata: {
            parserEngine: input.parserEngine,
            parserStatus: input.parserStatus,
        },
        sourceRole: input.sourceRole,
        sourceTopics: [],
        truncated: false,
    }
}

function sourceIdForPath(path: string): string {
    return `source_${contentHash(path).slice(0, 32)}`
}

function sectionIdFor(
    path: string,
    index: number,
    anchor: string,
    hash: string,
): string {
    return `section_${contentHash(`${path}:${index}:${anchor}:${hash}`).slice(0, 32)}`
}

import type {
    MemoryRecallInput,
    MemorySearchInput,
} from '@/contracts/repositories/memory-repository'
import type { EmbeddingProviderContract as EmbeddingProvider } from '@/contracts/services/embedding-provider'
import type { SqliteConnection } from '@/database/actions/_db'
import hasSearchIndex from '@/database/actions/has-search-index'
import queryDiaries, { type DiaryRow } from '@/database/actions/query-diaries'
import queryFtsRows from '@/database/actions/query-fts-rows'
import queryObservations, {
    type ObservationRow,
} from '@/database/actions/query-observations'
import queryRetrievalDocuments, {
    type RetrievalDocumentRow,
} from '@/database/actions/query-retrieval-documents'
import withBoundActionDatabase from '@/database/actions/with-bound-action-database'
import type { MemorySearchResult } from '@/models/memory'
import { classifySourceRole } from '@/providers/project/source-classification'
import { estimateTextTokens } from '@/support/format/tokens'
import {
    allowResult,
    applyGroupAwarePruning,
    applyRolePolicy,
    compareSearchResults,
    detectIntent,
    type SearchIntent,
    type SearchMode,
    toFtsQuery,
    tokenize,
} from '../support/search-policy'
import {
    computeVectorScore,
    embedSearchQuery,
    makeSearchResult,
} from '../support/search-scoring'

type SearchMemoryOptions = {
    embeddingProvider?: EmbeddingProvider
}
export default async function searchMemory(
    db: SqliteConnection,
    input: MemorySearchInput | MemoryRecallInput,
    options: SearchMemoryOptions = {},
): Promise<MemorySearchResult[]> {
    return withBoundActionDatabase(db, () =>
        searchBoundMemory(db, input, options),
    )
}

async function searchBoundMemory(
    db: SqliteConnection,
    input: MemorySearchInput | MemoryRecallInput,
    options: SearchMemoryOptions,
): Promise<MemorySearchResult[]> {
    const mode: SearchMode = 'query' in input ? 'search' : 'recall'
    const limit = 'limit' in input ? (input.limit ?? 10) : 10
    const query = 'query' in input ? input.query : input.task
    const terms = tokenize(query)
    const intent = detectIntent(query)

    if (terms.length === 0) {
        return []
    }

    const retrievalResults = await searchRetrievalDocuments(
        terms,
        limit,
        mode,
        intent,
        options,
    )
    if (retrievalResults.length > 0) {
        return retrievalResults
    }

    if (await hasSearchIndex(db)) {
        const ftsResults = await searchFts(terms, limit, mode, intent)
        if (ftsResults.length > 0) {
            return ftsResults
        }
    }

    const observations = await queryObservations(terms, limit * 2)
    const diaries = await queryDiaries(terms, limit * 2)

    return applyGroupAwarePruning(
        [
            ...observations.map(row => observationToResult(row, terms)),
            ...diaries.map(row => diaryToResult(row, terms)),
        ],
        mode,
        limit,
    )
        .filter(result => allowResult(result, mode, intent))
        .sort(compareSearchResults)
        .slice(0, limit)
}

async function searchRetrievalDocuments(
    terms: string[],
    limit: number,
    mode: SearchMode,
    intent: SearchIntent,
    options: SearchMemoryOptions,
): Promise<MemorySearchResult[]> {
    const ftsQuery = toFtsQuery(terms)
    if (!ftsQuery) {
        return []
    }
    const queryVector = await embedSearchQuery(options.embeddingProvider, terms)
    const rows = await queryRetrievalDocuments(
        options.embeddingProvider?.model ?? '',
        options.embeddingProvider?.dimensions ?? 0,
        ftsQuery,
        limit * 4,
    )

    return applyGroupAwarePruning(
        rows.map(row =>
            retrievalDocumentToResult(row, terms, {
                provider: options.embeddingProvider,
                queryVector,
            }),
        ),
        mode,
        limit,
    )
        .filter(result => allowResult(result, mode, intent))
        .map(result => applyRolePolicy(result, mode, intent))
        .sort(compareSearchResults)
        .slice(0, limit)
}

async function searchFts(
    terms: string[],
    limit: number,
    mode: SearchMode,
    intent: SearchIntent,
): Promise<MemorySearchResult[]> {
    const ftsQuery = toFtsQuery(terms)
    if (!ftsQuery) {
        return []
    }

    const rows = await queryFtsRows(ftsQuery, limit)

    return applyGroupAwarePruning(
        rows.map(row =>
            makeSearchResult({
                confidence: row.confidence ?? 1,
                content: row.content,
                createdAt: row.created_at,
                id: row.id,
                kind: row.kind ?? undefined,
                sourceId: row.source_id ?? undefined,
                task: row.task ?? undefined,
                terms,
                tokenCost: row.token_count ?? estimateTextTokens(row.content),
                type: row.type,
            }),
        ),
        mode,
        limit,
    )
        .filter(result => allowResult(result, mode, intent))
        .sort(compareSearchResults)
}

function observationToResult(
    row: ObservationRow,
    terms: string[],
): MemorySearchResult {
    const excerpt = row.text_inline ?? ''
    return makeSearchResult({
        confidence: row.confidence,
        content: excerpt,
        createdAt: row.created_at,
        id: row.id,
        kind: row.kind,
        terms,
        type: 'memory',
    })
}

function diaryToResult(row: DiaryRow, terms: string[]): MemorySearchResult {
    const tags = safeParseTags(row.tags_json)
    const text = [row.subject, row.summary, tags.join(' ')]
        .filter(Boolean)
        .join('\n')
    return makeSearchResult({
        confidence: 1,
        content: row.summary,
        createdAt: row.created_at,
        id: row.id,
        kind: 'diary',
        terms,
        textForScoring: text,
        type: 'diary',
    })
}

function safeParseTags(raw: string | null): string[] {
    if (!raw) {
        return []
    }
    try {
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) {
            return []
        }
        return parsed.filter(value => typeof value === 'string')
    } catch {
        return []
    }
}

function retrievalDocumentToResult(
    row: RetrievalDocumentRow,
    terms: string[],
    vectorInput: {
        provider?: EmbeddingProvider
        queryVector?: Float32Array
    },
): MemorySearchResult {
    const sourceRole = resolveSourceRole(row.source_role, row.path)
    const location = row.path
        ? row.anchor
            ? `${row.path}#${row.anchor}`
            : row.path
        : row.target_id
    const type = row.target_type
    const excerpt = row.summary
        ? `${location}\n${row.summary}`
        : `${location}\n${row.fts_text}`

    const vectorScore = computeVectorScore(row, vectorInput)

    return makeSearchResult({
        anchor: row.anchor ?? undefined,
        confidence: 1,
        content: excerpt,
        createdAt: row.updated_at,
        embeddingDimensions: row.embedding_dimensions ?? undefined,
        embeddingModel: row.embedding_model ?? undefined,
        id: row.target_id,
        kind: sourceRole,
        path: row.path ?? undefined,
        sourceId: row.source_id ?? undefined,
        sourceRole,
        targetType: row.target_type,
        terms,
        tokenCost:
            row.token_count ?? estimateTextTokens(row.summary ?? row.fts_text),
        type,
        vectorScore,
    })
}

function resolveSourceRole(
    sourceRole: string | null,
    path: string | null,
): string | undefined {
    if (sourceRole) {
        return sourceRole
    }
    if (!path) {
        return undefined
    }
    return classifySourceRole(path)
}

import type { RecallInput, SearchInput } from '../mcp/inputs.js'
import type { EmbeddingProvider } from '../mining/embedding-provider.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import { hasSearchIndex } from './search-index.js'

export type MemorySearchResult = {
    id: string
    type: 'chunk' | 'diary' | 'memory' | 'module' | 'session'
    kind?: string
    anchor?: string
    embeddingDimensions?: number
    embeddingModel?: string
    path?: string
    sourceId?: string
    sourceRole?: string
    status?: string
    task?: string
    excerpt: string
    score: number
    tokenCost: number
    scoreDetails: {
        confidence: number
        lexical: number
        recency: number
        tokenCostPenalty: number
        vector?: number
    }
    targetType?: 'chunk' | 'module'
    vectorScore?: number
    createdAt: string
}

type SearchMemoryOptions = {
    embeddingProvider?: EmbeddingProvider
}
type SearchMode = 'recall' | 'search'
type SearchIntent = {
    allowsDiary: boolean
    prefersAgentReference: boolean
}

type ObservationRow = {
    id: string
    kind: string
    text_inline: string | null
    confidence: number
    created_at: string
}

type HandoffRow = {
    id: string
    task: string
    status: string
    summary: string
    created_at: string
}

type DiaryRow = {
    id: string
    subject: string | null
    summary: string
    tags_json: string | null
    created_at: string
}

type FtsRow = {
    id: string
    type: 'chunk' | 'diary' | 'memory' | 'session'
    kind: string | null
    task: string | null
    content: string
    created_at: string
    rank: number
    source_id: string | null
    token_count: number | null
    confidence: number | null
}

type RetrievalDocumentRow = {
    anchor: string | null
    embedding_dimensions: number | null
    embedding_model: string | null
    path: string | null
    rank: number
    source_id: string | null
    source_role: string | null
    target_id: string
    target_type: 'chunk' | 'module'
    summary: string | null
    fts_text: string
    updated_at: string
    token_count: number | null
    vector_blob: Uint8Array | null
}

const maxExcerptTokens = 120

export async function searchMemory(
    adapter: SqliteAdapter,
    input: SearchInput | RecallInput,
    options: SearchMemoryOptions = {},
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
        adapter,
        terms,
        limit,
        mode,
        intent,
        options,
    )
    if (retrievalResults.length > 0) {
        return retrievalResults
    }

    if (await hasSearchIndex(adapter)) {
        const ftsResults = await searchFts(adapter, terms, limit, mode, intent)
        if (ftsResults.length > 0) {
            return ftsResults
        }
    }

    const observations = await adapter.query<ObservationRow>(
        `
select id, kind, text_inline, confidence, created_at
from observations
where (${terms.map(() => "lower(coalesce(text_inline, '')) like ?").join(' or ')})
  and deleted_at is null
  and suppressed_at is null
order by created_at desc
limit ?
`,
        [...terms.map(term => `%${term}%`), limit * 2],
    )
    const handoffs = await adapter.query<HandoffRow>(
        `
select id, task, status, summary, created_at
from session_handoffs
where (${terms
            .map(() => '(lower(summary) like ? or lower(task) like ?)')
            .join(' or ')})
  and deleted_at is null
  and suppressed_at is null
order by created_at desc
limit ?
`,
        [...terms.flatMap(term => [`%${term}%`, `%${term}%`]), limit * 2],
    )
    const diaries = await adapter.query<DiaryRow>(
        `
select id, subject, summary, tags_json, created_at
from diary_entries
where (${terms
            .map(
                () =>
                    "(lower(summary) like ? or lower(coalesce(subject, '')) like ? or lower(coalesce(tags_json, '')) like ?)",
            )
            .join(' or ')})
  and deleted_at is null
  and suppressed_at is null
order by created_at desc
limit ?
`,
        [
            ...terms.flatMap(term => [`%${term}%`, `%${term}%`, `%${term}%`]),
            limit * 2,
        ],
    )

    return applyGroupAwarePruning(
        [
            ...observations.map(row => observationToResult(row, terms)),
            ...diaries.map(row => diaryToResult(row, terms)),
            ...handoffs.map(row => handoffToResult(row, terms)),
        ],
        mode,
        intent,
        limit,
    )
        .filter(result => allowResult(result, mode, intent))
        .sort(compareSearchResults)
        .slice(0, limit)
}

async function searchRetrievalDocuments(
    adapter: SqliteAdapter,
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
    const rows = await adapter.query<RetrievalDocumentRow>(
        `
select
    rd.target_id,
    rd.target_type,
    rd.summary,
    rd.fts_text,
    rd.source_id,
    rd.source_role,
    rd.path,
    rd.anchor,
    rd.updated_at,
    c.token_count,
    bm25(retrieval_documents_fts) as rank,
    te.model as embedding_model,
    te.dimensions as embedding_dimensions,
    te.vector_blob
from retrieval_documents_fts
join retrieval_documents rd
    on rd.target_id = retrieval_documents_fts.target_id
   and rd.target_type = retrieval_documents_fts.target_type
left join chunks c
    on c.id = rd.target_id
   and rd.target_type = 'chunk'
left join target_embeddings te
    on te.target_id = rd.target_id
   and te.target_type = rd.target_type
   and te.model = ?
   and te.dimensions = ?
where rd.target_type in ('chunk', 'module')
  and retrieval_documents_fts match ?
  and not exists (
      select 1 from chunks dc
      where dc.id = rd.target_id
        and rd.target_type = 'chunk'
        and (dc.deleted_at is not null or dc.suppressed_at is not null)
  )
order by rank
limit ?
`,
        [
            options.embeddingProvider?.model ?? '',
            options.embeddingProvider?.dimensions ?? 0,
            ftsQuery,
            limit * 4,
        ],
    )

    return applyGroupAwarePruning(
        rows.map(row =>
            retrievalDocumentToResult(row, terms, {
                provider: options.embeddingProvider,
                queryVector,
            }),
        ),
        mode,
        intent,
        limit,
    )
        .filter(result => allowResult(result, mode, intent))
        .map(result => applyRolePolicy(result, mode, intent))
        .sort(compareSearchResults)
        .slice(0, limit)
}

async function searchFts(
    adapter: SqliteAdapter,
    terms: string[],
    limit: number,
    mode: SearchMode,
    intent: SearchIntent,
): Promise<MemorySearchResult[]> {
    const ftsQuery = toFtsQuery(terms)
    if (!ftsQuery) {
        return []
    }

    const rows = await adapter.query<FtsRow>(
        `
select
    memory_fts.id,
    memory_fts.type,
    memory_fts.kind,
    memory_fts.task,
    memory_fts.content,
    memory_fts.created_at,
    bm25(memory_fts) as rank,
    c.source_id,
    c.token_count,
    o.confidence
from memory_fts
left join chunks c on c.id = memory_fts.id
left join observations o on o.id = memory_fts.id
left join session_handoffs h on h.id = memory_fts.id
where memory_fts match ?
  and not exists (
      select 1 from chunks dc
      where dc.id = memory_fts.id
        and (dc.deleted_at is not null or dc.suppressed_at is not null)
  )
  and not exists (
      select 1 from observations do
      where do.id = memory_fts.id
        and (do.deleted_at is not null or do.suppressed_at is not null)
  )
  and not exists (
      select 1 from session_handoffs dh
      where dh.id = memory_fts.id
        and (dh.deleted_at is not null or dh.suppressed_at is not null)
  )
order by rank
limit ?
`,
        [ftsQuery, limit],
    )

    return applyGroupAwarePruning(
        rows.map(row =>
            makeSearchResult({
                confidence: row.confidence ?? 1,
                content: row.content,
                createdAt: row.created_at,
                id: row.id,
                kind:
                    row.type !== 'session'
                        ? (row.kind ?? undefined)
                        : undefined,
                sourceId: row.source_id ?? undefined,
                status:
                    row.type === 'session'
                        ? (row.kind ?? undefined)
                        : undefined,
                task: row.task ?? undefined,
                terms,
                tokenCost: row.token_count ?? estimateTokens(row.content),
                type: row.type,
            }),
        ),
        mode,
        intent,
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

function handoffToResult(row: HandoffRow, terms: string[]): MemorySearchResult {
    const text = `${row.task}\n${row.summary}`
    return makeSearchResult({
        confidence: 1,
        content: row.summary,
        createdAt: row.created_at,
        id: row.id,
        status: row.status,
        task: row.task,
        terms,
        textForScoring: text,
        type: 'session',
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
        kind: row.source_role ?? undefined,
        path: row.path ?? undefined,
        sourceId: row.source_id ?? undefined,
        sourceRole: row.source_role ?? undefined,
        targetType: row.target_type,
        terms,
        tokenCost:
            row.token_count ?? estimateTokens(row.summary ?? row.fts_text),
        type,
        vectorScore,
    })
}

function makeSearchResult(input: {
    anchor?: string
    confidence: number
    content: string
    createdAt: string
    embeddingDimensions?: number
    embeddingModel?: string
    id: string
    kind?: string
    path?: string
    sourceId?: string
    sourceRole?: string
    status?: string
    targetType?: 'chunk' | 'module'
    task?: string
    terms: string[]
    textForScoring?: string
    tokenCost?: number
    type: MemorySearchResult['type']
    vectorScore?: number
}): MemorySearchResult {
    const tokenCost = input.tokenCost ?? estimateTokens(input.content)
    const lexical = scoreText(
        input.textForScoring ?? input.content,
        input.terms,
    )
    const recency = recencyBoost(input.createdAt)
    const tokenCostPenalty = Math.ceil(tokenCost / 120)
    const confidence = Math.max(0, Math.min(input.confidence, 1))
    const score = Math.round(
        lexical * 100 +
            (input.vectorScore ?? 0) * 60 +
            confidence * 20 +
            recency -
            tokenCostPenalty,
    )

    return {
        anchor: input.anchor,
        createdAt: input.createdAt,
        embeddingDimensions: input.embeddingDimensions,
        embeddingModel: input.embeddingModel,
        excerpt: trimToTokenBudget(input.content, maxExcerptTokens),
        id: input.id,
        kind: input.kind,
        path: input.path,
        score,
        scoreDetails: {
            confidence,
            lexical,
            recency,
            tokenCostPenalty,
            vector: input.vectorScore,
        },
        sourceId: input.sourceId,
        sourceRole: input.sourceRole,
        status: input.status,
        targetType: input.targetType,
        task: input.task,
        tokenCost: Math.min(tokenCost, maxExcerptTokens),
        type: input.type,
        vectorScore: input.vectorScore,
    }
}

async function embedSearchQuery(
    provider: EmbeddingProvider | undefined,
    terms: string[],
): Promise<Float32Array | undefined> {
    if (!provider) {
        return undefined
    }

    try {
        const vectors = await provider.embed([terms.join(' ')])
        const vector = vectors[0]
        return vector?.length === provider.dimensions ? vector : undefined
    } catch {
        return undefined
    }
}

function computeVectorScore(
    row: RetrievalDocumentRow,
    input: {
        provider?: EmbeddingProvider
        queryVector?: Float32Array
    },
): number | undefined {
    if (
        !input.provider ||
        !input.queryVector ||
        !row.vector_blob ||
        row.embedding_model !== input.provider.model ||
        row.embedding_dimensions !== input.provider.dimensions
    ) {
        return undefined
    }

    const vector = blobToFloat32Array(row.vector_blob)
    if (vector.length !== input.provider.dimensions) {
        return undefined
    }

    return cosineSimilarity(input.queryVector, vector)
}

function blobToFloat32Array(blob: Uint8Array): Float32Array {
    const buffer = blob.buffer.slice(
        blob.byteOffset,
        blob.byteOffset + blob.byteLength,
    )
    return new Float32Array(buffer)
}

function cosineSimilarity(left: Float32Array, right: Float32Array): number {
    let dot = 0
    let leftNorm = 0
    let rightNorm = 0
    for (let index = 0; index < left.length; index += 1) {
        const leftValue = left[index] ?? 0
        const rightValue = right[index] ?? 0
        dot += leftValue * rightValue
        leftNorm += leftValue * leftValue
        rightNorm += rightValue * rightValue
    }

    if (leftNorm === 0 || rightNorm === 0) {
        return 0
    }

    return dot / Math.sqrt(leftNorm * rightNorm)
}

function tokenize(query: string): string[] {
    return [
        ...new Set(
            query
                .toLowerCase()
                .split(/[^a-z0-9_./-]+/u)
                .map(term => term.trim())
                .filter(term => term.length >= 2),
        ),
    ].slice(0, 12)
}

function toFtsQuery(terms: string[]): string | undefined {
    const ftsTerms = terms
        .map(term => term.replaceAll(/[^a-z0-9_]/gu, ''))
        .filter(Boolean)
        .map(term => `"${term}"`)

    return ftsTerms.length > 0 ? ftsTerms.join(' OR ') : undefined
}

function scoreText(text: string, terms: string[]): number {
    const lowerText = text.toLowerCase()
    return terms.reduce(
        (score, term) => score + (lowerText.includes(term) ? 1 : 0),
        0,
    )
}

function recencyBoost(createdAt: string): number {
    const timestamp = Date.parse(createdAt)
    if (Number.isNaN(timestamp)) {
        return 0
    }

    const ageDays = (Date.now() - timestamp) / 86_400_000
    return Math.max(0, 20 - Math.floor(ageDays))
}

function estimateTokens(text: string): number {
    return Math.ceil(text.trim().split(/\s+/u).filter(Boolean).length * 1.33)
}

function trimToTokenBudget(text: string, maxTokens: number): string {
    const words = text.trim().split(/\s+/u).filter(Boolean)
    const maxWords = Math.max(1, Math.floor(maxTokens / 1.33))

    if (words.length <= maxWords) {
        return text
    }

    return `${words.slice(0, maxWords).join(' ')}...`
}

function compareSearchResults(
    left: MemorySearchResult,
    right: MemorySearchResult,
): number {
    if (right.score !== left.score) {
        return right.score - left.score
    }

    return right.createdAt.localeCompare(left.createdAt)
}

function detectIntent(query: string): SearchIntent {
    const normalized = query.toLowerCase()
    return {
        allowsDiary:
            /\b(continue|resume|history|previous|last time|already tried|debug|blocked|why failed|follow up)\b/iu.test(
                normalized,
            ),
        prefersAgentReference:
            /\b(agent|skill|prompt|mcp|reference|docs?)\b/iu.test(normalized),
    }
}

function allowResult(
    result: MemorySearchResult,
    mode: SearchMode,
    intent: SearchIntent,
): boolean {
    if (mode === 'search') {
        return true
    }
    if (
        (result.type === 'diary' || result.type === 'session') &&
        !intent.allowsDiary
    ) {
        return false
    }
    return true
}

function applyRolePolicy(
    result: MemorySearchResult,
    mode: SearchMode,
    intent: SearchIntent,
): MemorySearchResult {
    const role = result.sourceRole ?? result.kind
    let scoreDelta = 0
    if (mode === 'recall') {
        if (
            role === 'agent_reference' ||
            role === 'generated' ||
            role === 'agent_config'
        ) {
            scoreDelta += intent.prefersAgentReference ? 20 : -60
        }
        if (
            role === 'app_code' ||
            role === 'product_doc' ||
            role === 'package_config'
        ) {
            scoreDelta += 15
        }
    }

    if (scoreDelta === 0) {
        return result
    }
    return {
        ...result,
        score: result.score + scoreDelta,
    }
}

function applyGroupAwarePruning(
    results: MemorySearchResult[],
    mode: SearchMode,
    _intent: SearchIntent,
    limit: number,
): MemorySearchResult[] {
    const maxPerType = mode === 'recall' ? 4 : 6
    const perType = new Map<string, number>()
    const selected: MemorySearchResult[] = []
    const sorted = [...results].sort(compareSearchResults)

    for (const item of sorted) {
        const key = item.type
        const count = perType.get(key) ?? 0
        if (count >= maxPerType) {
            continue
        }
        selected.push(item)
        perType.set(key, count + 1)
        if (selected.length >= limit * 2) {
            break
        }
    }

    return selected
}

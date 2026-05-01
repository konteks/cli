import type { RecallInput, SearchInput } from '../mcp/inputs.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import { hasSearchIndex } from './search-index.js'

export type MemorySearchResult = {
    id: string
    type: 'chunk' | 'memory' | 'module' | 'session'
    kind?: string
    sourceId?: string
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
    }
    createdAt: string
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

type FtsRow = {
    id: string
    type: 'chunk' | 'memory' | 'session'
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
    target_id: string
    target_type: 'chunk' | 'module'
    summary: string | null
    fts_text: string
    source_id: string | null
    source_role: string | null
    path: string | null
    anchor: string | null
    updated_at: string
    token_count: number | null
}

const maxExcerptTokens = 120

export async function searchMemory(
    adapter: SqliteAdapter,
    input: SearchInput | RecallInput,
): Promise<MemorySearchResult[]> {
    const limit = 'limit' in input ? (input.limit ?? 10) : 10
    const query = 'query' in input ? input.query : input.task
    const terms = tokenize(query)

    if (terms.length === 0) {
        return []
    }

    const retrievalResults = await searchRetrievalDocuments(
        adapter,
        terms,
        limit,
    )
    if (retrievalResults.length > 0) {
        return retrievalResults
    }

    if (await hasSearchIndex(adapter)) {
        const ftsResults = await searchFts(adapter, terms, limit)
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

    return [
        ...observations.map(row => observationToResult(row, terms)),
        ...handoffs.map(row => handoffToResult(row, terms)),
    ]
        .sort(compareSearchResults)
        .slice(0, limit)
}

async function searchRetrievalDocuments(
    adapter: SqliteAdapter,
    terms: string[],
    limit: number,
): Promise<MemorySearchResult[]> {
    const whereClause = terms
        .map(() => 'lower(rd.fts_text) like ?')
        .join(' or ')
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
    c.token_count
from retrieval_documents rd
left join chunks c
    on c.id = rd.target_id
   and rd.target_type = 'chunk'
where rd.target_type in ('chunk', 'module')
  and (${whereClause})
order by rd.updated_at desc
limit ?
`,
        [...terms.map(term => `%${term}%`), limit * 4],
    )

    return rows
        .map(row => retrievalDocumentToResult(row, terms))
        .sort(compareSearchResults)
        .slice(0, limit)
}

async function searchFts(
    adapter: SqliteAdapter,
    terms: string[],
    limit: number,
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

    return rows
        .map(row =>
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
        )
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

function retrievalDocumentToResult(
    row: RetrievalDocumentRow,
    terms: string[],
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

    return makeSearchResult({
        confidence: 1,
        content: excerpt,
        createdAt: row.updated_at,
        id: row.target_id,
        kind: row.source_role ?? undefined,
        sourceId: row.source_id ?? undefined,
        terms,
        tokenCost:
            row.token_count ?? estimateTokens(row.summary ?? row.fts_text),
        type,
    })
}

function makeSearchResult(input: {
    confidence: number
    content: string
    createdAt: string
    id: string
    kind?: string
    sourceId?: string
    status?: string
    task?: string
    terms: string[]
    textForScoring?: string
    tokenCost?: number
    type: MemorySearchResult['type']
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
        lexical * 100 + confidence * 20 + recency - tokenCostPenalty,
    )

    return {
        createdAt: input.createdAt,
        excerpt: trimToTokenBudget(input.content, maxExcerptTokens),
        id: input.id,
        kind: input.kind,
        score,
        scoreDetails: {
            confidence,
            lexical,
            recency,
            tokenCostPenalty,
        },
        sourceId: input.sourceId,
        status: input.status,
        task: input.task,
        tokenCost: Math.min(tokenCost, maxExcerptTokens),
        type: input.type,
    }
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

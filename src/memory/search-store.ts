import type { RecallInput, SearchInput } from '../mcp/inputs.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import { hasSearchIndex } from './search-index.js'

export type MemorySearchResult = {
    id: string
    type: 'memory' | 'session'
    kind?: string
    status?: string
    task?: string
    excerpt: string
    score: number
    createdAt: string
}

type ObservationRow = {
    id: string
    kind: string
    text_inline: string | null
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
    type: 'memory' | 'session'
    kind: string | null
    task: string | null
    content: string
    created_at: string
    rank: number
}

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

    if (await hasSearchIndex(adapter)) {
        const ftsResults = await searchFts(adapter, terms, limit)
        if (ftsResults.length > 0) {
            return ftsResults
        }
    }

    const observations = await adapter.query<ObservationRow>(
        `
select id, kind, text_inline, created_at
from observations
where ${terms.map(() => "lower(coalesce(text_inline, '')) like ?").join(' or ')}
order by created_at desc
limit ?
`,
        [...terms.map(term => `%${term}%`), limit * 2],
    )
    const handoffs = await adapter.query<HandoffRow>(
        `
select id, task, status, summary, created_at
from session_handoffs
where ${terms
            .map(() => '(lower(summary) like ? or lower(task) like ?)')
            .join(' or ')}
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
select id, type, kind, task, content, created_at, bm25(memory_fts) as rank
from memory_fts
where memory_fts match ?
order by rank
limit ?
`,
        [ftsQuery, limit],
    )

    return rows.map(row => ({
        createdAt: row.created_at,
        excerpt: row.content,
        id: row.id,
        kind: row.type === 'memory' ? (row.kind ?? undefined) : undefined,
        score: Math.max(1, Math.round(Math.abs(row.rank) * 1000)),
        status: row.type === 'session' ? (row.kind ?? undefined) : undefined,
        task: row.task ?? undefined,
        type: row.type,
    }))
}

function observationToResult(
    row: ObservationRow,
    terms: string[],
): MemorySearchResult {
    const excerpt = row.text_inline ?? ''
    return {
        createdAt: row.created_at,
        excerpt,
        id: row.id,
        kind: row.kind,
        score: scoreText(excerpt, terms),
        type: 'memory',
    }
}

function handoffToResult(row: HandoffRow, terms: string[]): MemorySearchResult {
    const text = `${row.task}\n${row.summary}`
    return {
        createdAt: row.created_at,
        excerpt: row.summary,
        id: row.id,
        score: scoreText(text, terms),
        status: row.status,
        task: row.task,
        type: 'session',
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

function compareSearchResults(
    left: MemorySearchResult,
    right: MemorySearchResult,
): number {
    if (right.score !== left.score) {
        return right.score - left.score
    }

    return right.createdAt.localeCompare(left.createdAt)
}

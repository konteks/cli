import type { MemorySearchResult } from '../memory/search-store.js'

export function formatWarmUpText(input: {
    summary: string
    description?: string
    technologies: string[]
    entryPoints: string[]
    keyFiles: string[]
    architecture: string[]
    durableDecisions: string[]
    constraints: string[]
    conventions: string[]
}): string {
    return [
        'warm_up:',
        `  summary: ${inline(input.summary)}`,
        input.description
            ? `  description: ${inline(input.description)}`
            : null,
        `  stack: ${list(input.technologies)}`,
        input.entryPoints.length > 0
            ? `  entry: ${list(input.entryPoints)}`
            : null,
        '  key_files:',
        ...toBullets(input.keyFiles, 4),
        '  arch:',
        ...toBullets(input.architecture, 4),
        '  decisions:',
        ...toBullets(input.durableDecisions, 4),
        '  constraints:',
        ...toBullets(input.constraints, 4),
        '  conventions:',
        ...toBullets(input.conventions, 4),
    ]
        .filter((line): line is string => line !== null)
        .join('\n')
}

export function formatRecallText(input: {
    task: string
    memories: MemorySearchResult[]
    graphCount: number
    historyCount: number
    graphEvidence: string[]
    historyEvidence: string[]
}): string {
    return [
        'recall:',
        `  task: ${inline(input.task)}`,
        `  graph_items: ${input.graphCount}`,
        `  history_items: ${input.historyCount}`,
        '  graph_evidence:',
        ...toBullets(input.graphEvidence, 4),
        '  history_evidence:',
        ...toBullets(input.historyEvidence, 4),
        '  memories:',
        ...input.memories.slice(0, 8).map(memory => formatMemory(memory, 4)),
    ].join('\n')
}

export function formatSearchText(input: {
    query: string
    limit: number
    results: MemorySearchResult[]
}): string {
    return [
        'search:',
        `  query: ${inline(input.query)}`,
        `  limit: ${input.limit}`,
        '  results:',
        ...input.results
            .slice(0, input.limit)
            .map(item => formatMemory(item, 4)),
    ].join('\n')
}

export function formatSaveText(input: {
    diaryId?: string
    memoryIds?: string[]
    skippedMemories?: number
}): string {
    const memoryCount = input.memoryIds?.length ?? 0
    const parts = ['konteks: session saved']

    if (input.diaryId) {
        parts.push('1 diary entry')
    }
    if (memoryCount > 0) {
        parts.push(`${memoryCount} durable memories`)
    }
    if (input.skippedMemories && input.skippedMemories > 0) {
        parts.push(`${input.skippedMemories} redundant items skipped`)
    }

    return `${parts.join(', ')}.`
}

function formatMemory(item: MemorySearchResult, indent: number): string {
    const pad = ' '.repeat(indent)
    const summary = item.excerpt.replaceAll(/\s+/gu, ' ').trim()
    return `${pad}- [${item.type}] path=${item.path ?? '-'} role=${item.sourceRole ?? item.kind ?? '-'} :: ${inline(summary)}`
}

function list(values: string[]): string {
    return values.length > 0 ? values.join(', ') : '-'
}

function toBullets(values: string[], indent: number): string[] {
    const pad = ' '.repeat(indent)
    if (values.length === 0) {
        return [`${pad}- -`]
    }
    return values.slice(0, 10).map(value => `${pad}- ${inline(value)}`)
}

function inline(value: string): string {
    return value.trim().replaceAll(/\s+/gu, ' ')
}

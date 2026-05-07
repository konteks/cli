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
    brief: string[]
    task: string
    memories: MemorySearchResult[]
    primaryTargets: string[]
    graphCount: number
    historyCount: number
    graphEvidence: string[]
    historyEvidence: string[]
    includeSources?: boolean
}): string {
    return [
        'recall:',
        `  task: ${inline(input.task)}`,
        '  brief:',
        ...toBullets(input.brief, 4),
        input.primaryTargets.length > 0 ? '  primary_targets:' : null,
        ...toBullets(input.primaryTargets, 4, { empty: false }),
        `  evidence_counts: memories=${input.memories.length}, graph=${input.graphCount}, history=${input.historyCount}`,
        input.graphEvidence.length > 0 ? '  graph_evidence:' : null,
        ...toBullets(input.graphEvidence, 4, { empty: false }),
        input.historyEvidence.length > 0 ? '  history_evidence:' : null,
        ...toBullets(input.historyEvidence, 4, { empty: false }),
        '  memories:',
        ...input.memories
            .slice(0, 8)
            .map(memory => formatMemory(memory, 4, input.includeSources)),
    ]
        .filter((line): line is string => line !== null)
        .join('\n')
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

function formatMemory(
    item: MemorySearchResult,
    indent: number,
    includeSources = false,
): string {
    const pad = ' '.repeat(indent)
    const summary = item.excerpt.replaceAll(/\s+/gu, ' ').trim()
    const location = item.anchor
        ? `${item.path ?? item.id}#${item.anchor}`
        : (item.path ?? item.id)
    const role = item.sourceRole ?? item.kind ?? '-'
    const base = `${pad}- [${item.type}] score=${item.score} ${location} role=${role} :: ${inline(summary)}`
    if (!includeSources) {
        return base
    }
    return `${base} id=${item.id} tokens=${item.tokenCost}`
}

function list(values: string[]): string {
    return values.length > 0 ? values.join(', ') : '-'
}

function toBullets(
    values: string[],
    indent: number,
    options: { empty?: boolean } = {},
): string[] {
    const pad = ' '.repeat(indent)
    if (values.length === 0) {
        return options.empty === false ? [] : [`${pad}- none`]
    }
    return values.slice(0, 10).map(value => `${pad}- ${inline(value)}`)
}

function inline(value: string): string {
    return value.trim().replaceAll(/\s+/gu, ' ')
}

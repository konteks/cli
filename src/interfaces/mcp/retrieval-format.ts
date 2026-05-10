import type { MemorySearchResult } from '../../infrastructure/persistence/sqlite/search-store.js'
import type { RecallPackage } from '../../types/mcp.js'
import { graphEvidenceLines, historyEvidenceLines } from './recall-package.js'
import type {
    WarmUpContext,
    WarmUpGuidance,
    WarmUpHighlight,
} from './warm-up-context.js'

export function formatWarmUpText(input: {
    warmUp: WarmUpContext
    recall?: RecallPackage
}): string {
    const { warmUp, recall } = input
    const lines = [
        'warm_up:',
        `  summary: ${inline(warmUp.summary)}`,
        warmUp.description
            ? `  description: ${inline(warmUp.description)}`
            : null,
        `  stack: ${list(warmUp.technologies)}`,
        warmUp.entryPoints.length > 0
            ? `  entry: ${list(warmUp.entryPoints)}`
            : null,
        '  highlights:',
        ...warmUp.highlights
            .slice(0, 8)
            .map(highlight => formatWarmUpHighlight(highlight, 4)),
        '  guidance:',
        ...warmUp.guidance.slice(0, 10).map(item => formatGuidance(item, 4)),
    ]

    if (recall) {
        lines.push(
            '  recall:',
            `    task: ${inline(recall.task)}`,
            recall.quality ? `    quality: ${recall.quality}` : null,
            '    brief:',
            ...toBullets(recall.brief, 6),
            recall.primaryTargets.length > 0 ? '    primary_targets:' : null,
            ...toBullets(recall.primaryTargets, 6, { empty: false }),
            `    evidence_counts: memories=${recall.memories.length}, sources=${recall.sourceCount}`,
            '    memories:',
            ...recall.memories
                .slice(0, 6)
                .map(memory => formatMemory(memory, 6)),
        )
    }

    return lines.filter((line): line is string => line !== null).join('\n')
}

export function formatRecallText(input: {
    recall: RecallPackage
    includeSources?: boolean
}): string {
    const { recall, includeSources } = input
    return [
        'recall:',
        `  task: ${inline(recall.task)}`,
        '  brief:',
        ...toBullets(recall.brief, 4),
        recall.primaryTargets.length > 0 ? '  primary_targets:' : null,
        ...toBullets(recall.primaryTargets, 4, { empty: false }),
        `  evidence_counts: memories=${recall.memories.length}, graph=${recall.graph.length}, history=${recall.history.length}`,
        recall.graph.length > 0 ? '  graph_evidence:' : null,
        ...toBullets(graphEvidenceLines(recall.graph), 4, { empty: false }),
        recall.history.length > 0 ? '  history_evidence:' : null,
        ...toBullets(historyEvidenceLines(recall.history), 4, { empty: false }),
        '  memories:',
        ...recall.memories
            .slice(0, 8)
            .map(memory => formatMemory(memory, 4, includeSources)),
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

function formatWarmUpHighlight(item: WarmUpHighlight, indent: number): string {
    const pad = ' '.repeat(indent)
    const location = item.anchor
        ? `${item.path ?? item.id}#${item.anchor}`
        : (item.path ?? item.id)
    const role = item.sourceRole ?? '-'
    const summary = item.excerpt.replaceAll(/\s+/gu, ' ').trim()
    return `${pad}- [${item.type}] score=${item.score} ${location} role=${role} :: ${inline(summary)}`
}

function formatGuidance(item: WarmUpGuidance, indent: number): string {
    const pad = ' '.repeat(indent)
    return `${pad}- [${item.kind}] ${inline(item.text)}`
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

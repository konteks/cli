import z from 'zod'
import { withMemoryRepository } from '@/database/services/memory-repository'
import { readProjectWarmUpContext } from '@/database/services/warm-up-memory'
import formatMemory from '@/mcp/tools/utils/format-memory'
import inline from '@/mcp/tools/utils/inline'
import recallRepositoryMemory from '@/memory/recall-repository-memory'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
} from '@/memory/runtime'
import type {
    RecallPackage,
    WarmUpContext,
    WarmUpGuidance,
    WarmUpHighlight,
} from '@/models/memory'
import { estimateCharacterTokens } from '@/support/format/tokens'
import BaseMcpTool from './_base-mcp-tool'
import toBullets from './utils/to-bullets'

const INPUT_ZOD_SCHEMA = z.object({
    maxTokens: z.number().int().min(1).max(8000).optional(),
    topic: z.string().optional(),
})

type Input = z.output<typeof INPUT_ZOD_SCHEMA>

export default class WarmUpMcpTool extends BaseMcpTool<Input> {
    public readonly annotations = {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
    }

    public readonly description =
        'Load the stable project-wide briefing for the current repo.'

    public readonly inputSchema = INPUT_ZOD_SCHEMA

    public readonly name = 'konteks_warm_up'

    public async handle(input: Input): Promise<string> {
        const result = await warmUpMemory(input)
        return formatWarmUpText(result)
    }
}

type WarmUpResult = {
    warmUp: WarmUpContext
    recall?: RecallPackage
}

async function warmUpMemory(input: {
    maxTokens?: number
    topic?: string
}): Promise<WarmUpResult> {
    const context = await loadMcpProjectContext()
    await updateChangedProjectMemorySilently(context)

    const rawWarmUp = await readProjectWarmUpContext(context)
    const warmUp = limitWarmUpContext(rawWarmUp, input.maxTokens ?? 2000)

    let recall: RecallPackage | undefined
    if (input.topic) {
        recall = await withMemoryRepository(context, repository =>
            recallRepositoryMemory(repository, {
                maxTokens: input.maxTokens ?? 2000,
                task: input.topic ?? '',
            }),
        )
    }

    return { recall, warmUp }
}

function formatWarmUpText(input: WarmUpResult): string {
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

function limitWarmUpContext(
    context: WarmUpContext,
    maxTokens: number,
): WarmUpContext {
    const budget = Math.max(80, maxTokens)
    const baseCost = estimateCharacterTokens([
        context.summary,
        context.description ?? '',
        ...context.technologies,
        ...context.entryPoints,
    ])
    let remaining = Math.max(0, budget - baseCost)

    const take = (items: string[], fallbackLimit: number): string[] => {
        const kept: string[] = []
        for (const item of items.slice(0, fallbackLimit)) {
            const cost = estimateCharacterTokens([item])
            if (kept.length > 0 && cost > remaining) {
                break
            }
            kept.push(item)
            remaining -= cost
        }
        return kept
    }

    return {
        ...context,
        architecture: take(context.architecture, 12),
        guidance: context.guidance.slice(0, 8),
        highlights: context.highlights.slice(0, 12),
        keyFiles: take(context.keyFiles, 12),
    }
}

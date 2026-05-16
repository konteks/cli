import z from 'zod'
import formatMemory from '@/mcp/tools/utils/format-memory'
import inline from '@/mcp/tools/utils/inline'
import warmUpMemory from '@/memory/warm-up-memory'
import type { StartMcpServerOptions } from '@/models/mcp'
import type {
    RecallPackage,
    WarmUpContext,
    WarmUpGuidance,
    WarmUpHighlight,
} from '@/models/memory'
import BaseMcpTool from './_base-mcp-tool'
import toBullets from './utils/to-bullets'

const INPUT_ZOD_SCHEMA = z.object({
    maxTokens: z.number().int().min(1).max(8000).optional(),
    topic: z.string().optional(),
})

type Input = z.output<typeof INPUT_ZOD_SCHEMA>

export default class WarmUpMcpTool extends BaseMcpTool<Input> {
    annotations = {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
    }

    description = 'Load the stable project-wide briefing for the current repo.'

    readonly inputSchema = INPUT_ZOD_SCHEMA

    name = 'konteks_warm_up'

    protected async coreHandle(options: StartMcpServerOptions, input: Input) {
        const result = await warmUpMemory(options, input)
        return formatWarmUpText(result)
    }
}

function formatWarmUpText(input: {
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

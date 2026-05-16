import z from 'zod'
import { recallMemory } from '@/memory/recall'
import type { StartMcpServerOptions } from '@/models/mcp'
import type {
    RecallGraphItem,
    RecallHistoryItem,
    RecallPackage,
} from '@/models/memory'
import BaseMcpTool from './_base-mcp-tool'
import formatMemory from './utils/format-memory'
import inline from './utils/inline'
import toBullets from './utils/to-bullets'

const INPUT_SCHEMA = z.object({
    includeSources: z.boolean().optional(),
    maxTokens: z.number().int().min(1).max(8000).optional(),
    task: z.string().min(1, 'task is required'),
})

export default class RecallMcpTool extends BaseMcpTool {
    annotations = {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
    }

    description =
        'Recall compact, task-relevant project context before answering or working.'

    inputSchema = INPUT_SCHEMA

    name = 'konteks_recall'

    protected async coreHandle(
        options: StartMcpServerOptions,
        input: z.output<typeof INPUT_SCHEMA>,
    ) {
        return formatRecallText({
            includeSources: input.includeSources ?? false,
            recall: await recallMemory(options, input),
        })
    }
}

function formatRecallText(input: {
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

function graphEvidenceLines(graph: RecallGraphItem[]): string[] {
    return graph
        .slice(0, 6)
        .map(
            item =>
                `${item.entityName} ${item.predicate} ${item.relatedEntityName} (depth=${item.depth})`,
        )
}

function historyEvidenceLines(history: RecallHistoryItem[]): string[] {
    return history
        .slice(0, 6)
        .map(
            item =>
                `${item.subjectEntityName} ${item.predicate} ${item.objectEntityName} [${item.status}]`,
        )
}

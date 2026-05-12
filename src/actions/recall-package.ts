import type {
    MemorySearchResult,
    RecallGraphItem,
    RecallHistoryItem,
    RecallPackage,
} from '@/models/memory'

export function assembleRecallPackage(input: {
    graph: RecallGraphItem[]
    history: RecallHistoryItem[]
    includeSources: boolean
    maxTokens: number
    memories: MemorySearchResult[]
    task: string
}): RecallPackage {
    const dedupedMemories = dedupeRecallMemories(input.memories)
    const memories = applyTokenBudget(dedupedMemories, input.maxTokens).map(
        memory => (input.includeSources ? memory : compactMemory(memory)),
    )
    const primaryTargets = primaryRecallTargets(memories)
    const quality = recallQuality(memories)
    return {
        brief: recallBrief({
            graphCount: input.graph.length,
            historyCount: input.history.length,
            memories,
            primaryTargets,
            quality,
        }),
        graph: input.includeSources ? input.graph : input.graph.slice(0, 6),
        history: input.includeSources
            ? input.history
            : input.history.slice(0, 4),
        memories,
        primaryTargets,
        quality,
        sourceCount: dedupedMemories.length,
        task: input.task,
        tokenBudget: input.maxTokens,
    }
}

function applyTokenBudget(
    memories: MemorySearchResult[],
    maxTokens: number,
): MemorySearchResult[] {
    const selected: MemorySearchResult[] = []
    let usedTokens = 0

    for (const memory of memories) {
        // We use a heuristic for token cost if not provided
        const tokenCost =
            (memory.metadata?.tokenCost as number) ?? memory.excerpt.length / 4
        if (selected.length > 0 && usedTokens + tokenCost > maxTokens) {
            continue
        }

        selected.push(memory)
        usedTokens += tokenCost
    }

    return selected
}

function dedupeRecallMemories(
    memories: MemorySearchResult[],
): MemorySearchResult[] {
    const deduped: MemorySearchResult[] = []
    const seen = new Set<string>()
    for (const memory of memories) {
        const key = [
            memory.type,
            memory.path ?? '',
            memory.id,
            memory.excerpt.slice(0, 120),
        ].join('\0')
        if (seen.has(key)) {
            continue
        }
        seen.add(key)
        deduped.push(memory)
    }
    return deduped
}

function recallQuality(
    memories: MemorySearchResult[],
): RecallPackage['quality'] {
    if (memories.length === 0) {
        return 'weak'
    }
    const topScore = memories[0]?.score ?? 0
    const distinctTargets = new Set(
        memories.map(memory => memory.path ?? memory.id),
    ).size
    if (topScore >= 200 && distinctTargets >= 2) {
        return 'strong'
    }
    if (topScore >= 80) {
        return 'partial'
    }
    return 'weak'
}

function compactMemory(memory: MemorySearchResult): MemorySearchResult {
    return {
        createdAt: memory.createdAt,
        excerpt: memory.excerpt,
        id: memory.id,
        kind: memory.kind,
        path: memory.path,
        score: memory.score,
        type: memory.type,
    }
}

function primaryRecallTargets(memories: MemorySearchResult[]): string[] {
    const targets: string[] = []
    const seen = new Set<string>()
    const ordered = [...memories].sort((a, b) => b.score - a.score)
    for (const memory of ordered) {
        const target = memory.path ?? memory.id
        if (!target || seen.has(target)) {
            continue
        }
        seen.add(target)
        targets.push(target)
        if (targets.length >= 5) {
            break
        }
    }
    return targets
}

function recallBrief(input: {
    graphCount: number
    historyCount: number
    memories: MemorySearchResult[]
    primaryTargets: string[]
    quality: RecallPackage['quality']
}): string[] {
    const lines: string[] = []
    lines.push(`Quality: ${input.quality}.`)
    if (input.primaryTargets.length > 0) {
        lines.push(
            `Inspect first: ${input.primaryTargets.slice(0, 3).join(', ')}`,
        )
    }
    const typeCounts = countBy(input.memories, memory => memory.type)
    const evidence = Object.entries(typeCounts)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ')
    lines.push(evidence ? `Evidence: ${evidence}.` : 'Evidence: none found.')
    if (input.graphCount > 0 || input.historyCount > 0) {
        lines.push(
            `Relations: ${input.graphCount} active, ${input.historyCount} historical.`,
        )
    }
    return lines.slice(0, 4)
}

function countBy<T>(
    items: T[],
    keyFor: (item: T) => string,
): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const item of items) {
        const key = keyFor(item)
        counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
}

export function graphEvidenceLines(graph: RecallGraphItem[]): string[] {
    return graph
        .slice(0, 6)
        .map(
            item =>
                `${item.entityName} ${item.predicate} ${item.relatedEntityName} (depth=${item.depth})`,
        )
}

export function historyEvidenceLines(history: RecallHistoryItem[]): string[] {
    return history
        .slice(0, 6)
        .map(
            item =>
                `${item.subjectEntityName} ${item.predicate} ${item.objectEntityName} [${item.status}]`,
        )
}

// import { GraphStore } from '../memory/graph-store.js'
import type { MemorySearchResult } from '../memory/search-store.js'
import type { DatabaseService } from '../storage/db.js'
// import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import type {
    RecallGraphItem,
    RecallHistoryItem,
    RecallPackage,
} from '../types/mcp.js'

export async function recallHistory(
    db: DatabaseService,
    task: string,
): Promise<RecallHistoryItem[]> {
    if (!needsHistory(task)) {
        return []
    }

    const graph = db.graph
    const entities = await graph.searchEntities(task, { limit: 4 })
    const items: RecallHistoryItem[] = []

    for (const entity of entities) {
        const relations = await graph.historicalRelations(entity.id, {
            limit: 6,
        })

        for (const relation of relations) {
            items.push({
                objectEntityId: relation.object.id,
                objectEntityName: relation.object.name,
                predicate: relation.predicate,
                reason: `Included because task asks for historical or superseded context.`,
                relationId: relation.relationId,
                status: relation.status,
                subjectEntityId: relation.subject.id,
                subjectEntityName: relation.subject.name,
                validFrom: relation.validFrom,
                validTo: relation.validTo,
            })
        }
    }

    return dedupeHistory(items).slice(0, 8)
}

export async function recallGraph(
    db: DatabaseService,
    task: string,
): Promise<RecallGraphItem[]> {
    const graph = db.graph
    const entities = await graph.searchEntities(task, { limit: 4 })
    const items: RecallGraphItem[] = []

    for (const entity of entities) {
        const neighbors = await graph.traverseNeighbors(entity.id, {
            limit: 8,
            maxDepth: 2,
        })

        for (const neighbor of neighbors) {
            items.push({
                depth: neighbor.depth,
                direction: neighbor.direction,
                entityId: entity.id,
                entityName: entity.name,
                entityType: entity.type,
                predicate: neighbor.predicate,
                relatedEntityId: neighbor.entity.id,
                relatedEntityName: neighbor.entity.name,
                relatedEntityType: neighbor.entity.type,
                relationId: neighbor.relationId,
                score: Math.max(1, 10 - neighbor.depth * 2),
            })
        }
    }

    return items.sort((left, right) => right.score - left.score).slice(0, 12)
}

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

function needsHistory(task: string): boolean {
    return /\b(history|historical|previous|prior|old|before|changed|why|superseded|invalidated|replaced|migration|attempt|rollback|decision)\b/iu.test(
        task,
    )
}

function dedupeHistory(items: RecallHistoryItem[]): RecallHistoryItem[] {
    const seen = new Set<string>()
    const deduped: RecallHistoryItem[] = []

    for (const item of items) {
        if (seen.has(item.relationId)) {
            continue
        }

        seen.add(item.relationId)
        deduped.push(item)
    }

    return deduped
}

function applyTokenBudget(
    memories: MemorySearchResult[],
    maxTokens: number,
): MemorySearchResult[] {
    const selected: MemorySearchResult[] = []
    let usedTokens = 0

    for (const memory of memories) {
        const tokenCost = memory.tokenCost
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
            memory.anchor ?? '',
            memory.task ?? '',
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
        memories.map(memory => memory.path ?? memory.task ?? memory.id),
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
        anchor: memory.anchor,
        createdAt: memory.createdAt,
        excerpt: memory.excerpt,
        id: memory.id,
        kind: memory.kind,
        path: memory.path,
        score: memory.score,
        scoreDetails: memory.scoreDetails,
        sourceRole: memory.sourceRole,
        task: memory.task,
        tokenCost: memory.tokenCost,
        type: memory.type,
    }
}

function primaryRecallTargets(memories: MemorySearchResult[]): string[] {
    const targets: string[] = []
    const seen = new Set<string>()
    const ordered = [...memories].sort(comparePrimaryTargetMemory)
    for (const memory of ordered) {
        const target = memory.path ?? memory.task ?? memory.id
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

function comparePrimaryTargetMemory(
    left: MemorySearchResult,
    right: MemorySearchResult,
): number {
    const priorityDelta = targetPriority(right) - targetPriority(left)
    if (priorityDelta !== 0) {
        return priorityDelta
    }
    return right.score - left.score
}

function targetPriority(memory: MemorySearchResult): number {
    const role = memory.sourceRole ?? memory.kind
    if (role === 'app_code') {
        return 5
    }
    if (role === 'package_config') {
        return 4
    }
    if (role === 'test_code') {
        return 3
    }
    if (memory.type === 'memory') {
        return 2
    }
    if (role === 'product_doc') {
        return 1
    }
    return 0
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

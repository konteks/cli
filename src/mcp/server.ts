import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { forgetMemory } from '../memory/forget-store.js'
import { GraphStore } from '../memory/graph-store.js'
import { saveKonteksInput } from '../memory/save-store.js'
import {
    type MemorySearchResult,
    searchMemory,
} from '../memory/search-store.js'
import { loadProjectContext } from '../project/context.js'
import { getProjectStatus } from '../project/status.js'
import { openProjectDatabase } from '../storage/database.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import {
    bootstrapInputSchema,
    emptyInputSchema,
    forgetInputSchema,
    parseBootstrapInput,
    parseForgetInput,
    parseRecallInput,
    parseSaveInput,
    parseSearchInput,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
} from './inputs.js'
import { textResult } from './result.js'

type StartMcpServerOptions = {
    project?: string
}

type FlexibleRegisterTool = (
    name: string,
    config: {
        description: string
        inputSchema?: unknown
    },
    callback: (input: unknown) => CallToolResult | Promise<CallToolResult>,
) => unknown

type RecallGraphItem = {
    entityId: string
    entityName: string
    entityType: string
    relationId: string
    predicate: string
    direction: 'incoming' | 'outgoing'
    depth: number
    score: number
    relatedEntityId: string
    relatedEntityName: string
    relatedEntityType: string
}

type RecallHistoryItem = {
    relationId: string
    predicate: string
    status: 'invalidated' | 'superseded'
    subjectEntityId: string
    subjectEntityName: string
    objectEntityId: string
    objectEntityName: string
    validFrom?: string
    validTo?: string
    reason: string
}

export async function startMcpServer(
    options: StartMcpServerOptions,
): Promise<void> {
    const server = new McpServer(
        {
            name: 'konteks',
            version: '0.0.0',
        },
        {
            instructions:
                'Use konteks_bootstrap at session start, konteks_recall before project-specific work, and konteks_save to persist durable decisions or session handoffs. Do not expect MCP tools to perform heavy project mining.',
        },
    )
    const registerTool = server.registerTool.bind(
        server,
    ) as unknown as FlexibleRegisterTool

    registerTool(
        'konteks_status',
        {
            description:
                'Inspect Konteks project memory status, storage path, counts, capabilities, and setup health.',
            inputSchema: emptyInputSchema,
        },
        async () => textResult(await getProjectStatus(options.project)),
    )

    registerTool(
        'konteks_bootstrap',
        {
            description:
                'Load the stable project-wide briefing for the current repo and report whether memory is missing, fresh, or stale.',
            inputSchema: bootstrapInputSchema,
        },
        async input => {
            const parsed = parseBootstrapInput(input)
            const status = await getProjectStatus(options.project)
            return textResult({
                commonCommands: [
                    'konteks status',
                    'konteks mine --changed',
                    'konteks mcp',
                ],
                constraints: ['MCP tools do not run heavy project mining.'],
                freshness: status.freshness,
                keyFiles: [],
                project: {
                    memoryDir: status.memoryDir,
                    name: status.projectRoot.split('/').at(-1) ?? 'project',
                    root: status.projectRoot,
                },
                recentChanges: [],
                recentHandoffs: [],
                staleMemory: {
                    detected: status.freshness.status === 'stale',
                    reason:
                        status.freshness.status === 'stale'
                            ? status.freshness.reason
                            : undefined,
                    recommendedCommand: status.freshness.recommendedCommand,
                },
                suggestedNext:
                    status.freshness.recommendedCommand ??
                    `Call konteks_recall with a task-specific prompt. Requested budget: ${parsed.maxTokens ?? 2000} tokens.`,
                summary:
                    status.freshness.status === 'missing'
                        ? 'Konteks memory is not initialized yet.'
                        : 'Konteks bootstrap summaries are not implemented yet.',
                taxonomy: [],
                technologies: [],
            })
        },
    )

    registerTool(
        'konteks_recall',
        {
            description:
                'Recall compact, task-relevant project context before answering or working.',
            inputSchema: recallInputSchema,
        },
        async input => {
            const parsed = parseRecallInput(input)
            const recall = await withProjectDatabase(
                options,
                async adapter => ({
                    graph: await recallGraph(adapter, parsed.task),
                    history: await recallHistory(adapter, parsed.task),
                    memories: await searchMemory(adapter, parsed),
                }),
            )
            return textResult({
                graph: recall.graph,
                history: recall.history,
                memories: applyTokenBudget(
                    recall.memories,
                    parsed.maxTokens ?? 2000,
                ),
                task: parsed.task,
                tokenBudget: parsed.maxTokens ?? 2000,
            })
        },
    )

    registerTool(
        'konteks_search',
        {
            description:
                'Search stored memory directly and return matching records with IDs, sources, scores, and excerpts.',
            inputSchema: searchInputSchema,
        },
        async input => {
            const parsed = parseSearchInput(input)
            const results = await withProjectDatabase(options, adapter =>
                searchMemory(adapter, parsed),
            )
            return textResult({
                limit: parsed.limit ?? 10,
                query: parsed.query,
                results,
            })
        },
    )

    registerTool(
        'konteks_save',
        {
            description: 'Save durable memory or a structured session handoff.',
            inputSchema: saveInputSchema,
        },
        async input => {
            const parsed = parseSaveInput(input)
            const saved = await withProjectDatabase(
                options,
                (adapter, context) =>
                    saveKonteksInput(adapter, context, parsed),
            )
            return textResult(saved)
        },
    )

    registerTool(
        'konteks_forget',
        {
            description:
                'Delete, invalidate, or suppress stored memory that is wrong, stale, sensitive, or no longer useful.',
            inputSchema: forgetInputSchema,
        },
        async input => {
            const parsed = parseForgetInput(input)
            const result = await withProjectDatabase(options, adapter =>
                forgetMemory(adapter, parsed),
            )
            return textResult(result)
        },
    )

    await server.connect(new StdioServerTransport())
}

export async function recallHistory(
    adapter: SqliteAdapter,
    task: string,
): Promise<RecallHistoryItem[]> {
    if (!needsHistory(task)) {
        return []
    }

    const graph = new GraphStore(adapter)
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
    adapter: SqliteAdapter,
    task: string,
): Promise<RecallGraphItem[]> {
    const graph = new GraphStore(adapter)
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

async function withProjectDatabase<T>(
    options: StartMcpServerOptions,
    operation: (
        adapter: SqliteAdapter,
        context: Awaited<ReturnType<typeof loadProjectContext>>,
    ) => Promise<T>,
): Promise<T> {
    const context = await loadProjectContext(options.project)
    const adapter = await openProjectDatabase(context)

    try {
        return await operation(adapter, context)
    } finally {
        await adapter.close()
    }
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

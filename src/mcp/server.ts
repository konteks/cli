import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
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
            const memories = await withProjectDatabase(options, adapter =>
                searchMemory(adapter, parsed),
            )
            return textResult({
                graph: [],
                memories: applyTokenBudget(memories, parsed.maxTokens ?? 2000),
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
            return textResult({
                accepted: true,
                message:
                    'Forget validation passed. Memory hygiene persistence is planned in Phase 9.',
                mode: parsed.mode ?? 'soft_delete',
            })
        },
    )

    await server.connect(new StdioServerTransport())
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

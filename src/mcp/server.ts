import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { getProjectStatus } from '../project/status.js'
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
            return textResult({
                graph: [],
                memories: [],
                message:
                    'Recall is scaffolded. Storage and ranking are planned in later phases.',
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
            return textResult({
                limit: parsed.limit ?? 10,
                message:
                    'Search is scaffolded. SearchStore is planned in Phase 4.',
                query: parsed.query,
                results: [],
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
            return textResult({
                accepted: true,
                message:
                    'Save validation passed. Persistence is planned in Phase 4.',
                type: parsed.type,
            })
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

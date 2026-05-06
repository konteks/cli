import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
    CallToolRequestSchema,
    type CallToolResult,
    ErrorCode,
    GetPromptRequestSchema,
    type GetPromptResult,
    ListPromptsRequestSchema,
    ListToolsRequestSchema,
    McpError,
    type Prompt,
    type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { forgetMemory } from '../memory/forget-store.js'
import { GraphStore } from '../memory/graph-store.js'
import { saveKonteksInput } from '../memory/save-store.js'
import {
    type MemorySearchResult,
    searchMemory,
} from '../memory/search-store.js'
import { readMineManifest } from '../mining/manifest.js'
import { loadProjectContext } from '../project/context.js'
import { getProjectStatus } from '../project/status.js'
import { openProjectDatabase } from '../storage/database.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import { createToonStore } from '../storage/toon-store.js'
import {
    emptyInputSchema,
    forgetInputSchema,
    parseForgetInput,
    parseRecallInput,
    parseSaveInput,
    parseSearchInput,
    parseWarmUpInput,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
    warmUpInputSchema,
} from './inputs.js'
import { textResult } from './result.js'

type StartMcpServerOptions = {
    project?: string
}

type FlexibleRegisterTool = (
    name: string,
    config: {
        annotations?: Tool['annotations']
        description: string
        inputSchema: Tool['inputSchema']
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
    const server = new Server(
        {
            name: 'konteks',
            version: '0.0.0',
        },
        {
            capabilities: {
                prompts: {},
                tools: {},
            },
            instructions:
                'Use prompts for the Warm Up -> Build -> Save flow. Use konteks_warm_up at session start, konteks_recall as supplemental Build context, and konteks_save to persist durable decisions or session handoffs.',
        },
    )
    const tools = new Map<string, ToolRegistration>()
    const registerTool: FlexibleRegisterTool = (name, config, callback) => {
        tools.set(name, {
            annotations: config.annotations,
            callback,
            description: config.description,
            inputSchema: config.inputSchema,
            name,
        })
    }

    registerKonteksTools(options, registerTool)

    const prompts = createPromptDefinitions()

    server.setRequestHandler(ListPromptsRequestSchema, async () => ({
        prompts,
    }))

    server.setRequestHandler(GetPromptRequestSchema, async request => {
        const prompt = prompts.find(item => item.name === request.params.name)
        if (!prompt) {
            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown Konteks prompt: ${request.params.name}`,
            )
        }

        return getPromptResult(prompt, request.params.arguments ?? {})
    })

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [...tools.values()].map(tool => ({
            annotations: tool.annotations,
            description: tool.description,
            inputSchema: tool.inputSchema,
            name: tool.name,
        })),
    }))

    server.setRequestHandler(CallToolRequestSchema, async request => {
        const tool = tools.get(request.params.name)

        if (!tool) {
            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown Konteks tool: ${request.params.name}`,
            )
        }

        try {
            return await tool.callback(request.params.arguments ?? {})
        } catch (error) {
            throw new McpError(
                ErrorCode.InvalidParams,
                error instanceof Error ? error.message : String(error),
            )
        }
    })

    await server.connect(new StdioServerTransport())
}

type ToolRegistration = {
    annotations?: Tool['annotations']
    callback: (input: unknown) => CallToolResult | Promise<CallToolResult>
    description: string
    inputSchema: Tool['inputSchema']
    name: string
}

function registerKonteksTools(
    options: StartMcpServerOptions,
    registerTool: FlexibleRegisterTool,
): void {
    registerTool(
        'konteks_status',
        {
            annotations: {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true,
            },
            description:
                'Inspect Konteks project memory status, storage path, counts, capabilities, and setup health.',
            inputSchema: emptyInputSchema,
        },
        async () => textResult(await getProjectStatus(options.project)),
    )

    registerTool(
        'konteks_warm_up',
        {
            annotations: {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true,
            },
            description:
                'Load the stable project-wide briefing for the current repo and report whether memory is missing, fresh, or stale.',
            inputSchema: warmUpInputSchema,
        },
        async input => {
            const parsed = parseWarmUpInput(input)
            const status = await getProjectStatus(options.project)
            const context = await loadProjectContext(options.project)
            const warmUp = await assembleWarmUpContext(
                context,
                parsed.maxTokens,
            )
            return textResult({
                architecture: warmUp.architecture,
                commonCommands: [
                    'konteks status',
                    'konteks repair',
                    'konteks mcp',
                ],
                constraints: warmUp.constraints,
                durableDecisions: warmUp.durableDecisions,
                freshness: status.freshness,
                keyFiles: warmUp.keyFiles,
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
                summary: warmUp.summary,
                taxonomy: warmUp.taxonomy,
                technologies: warmUp.technologies,
            })
        },
    )

    registerTool(
        'konteks_recall',
        {
            annotations: {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true,
            },
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
            annotations: {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true,
            },
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
            annotations: {
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
                readOnlyHint: false,
            },
            description: 'Save durable memory or a structured diary entry.',
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
            annotations: {
                destructiveHint: true,
                idempotentHint: false,
                openWorldHint: false,
                readOnlyHint: false,
            },
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
}

export function listMcpPrompts(): Prompt[] {
    return createPromptDefinitions()
}

export function getMcpPrompt(
    name: string,
    args: Record<string, string> = {},
): GetPromptResult {
    const prompt = createPromptDefinitions().find(item => item.name === name)
    if (!prompt) {
        throw new Error(`Unknown Konteks prompt: ${name}`)
    }

    return getPromptResult(prompt, args)
}

export function listMcpTools(options: StartMcpServerOptions): Tool[] {
    return [...createToolRegistrations(options).values()].map(tool => ({
        description: tool.description,
        inputSchema: tool.inputSchema,
        name: tool.name,
    }))
}

export async function callMcpTool(
    options: StartMcpServerOptions,
    name: string,
    input: unknown = {},
): Promise<CallToolResult> {
    const tool = createToolRegistrations(options).get(name)
    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    return await tool.callback(input)
}

function createToolRegistrations(
    options: StartMcpServerOptions,
): Map<string, ToolRegistration> {
    const tools = new Map<string, ToolRegistration>()
    const registerTool: FlexibleRegisterTool = (name, config, callback) => {
        tools.set(name, {
            annotations: config.annotations,
            callback,
            description: config.description,
            inputSchema: config.inputSchema,
            name,
        })
    }

    registerKonteksTools(options, registerTool)
    return tools
}

function createPromptDefinitions(): Prompt[] {
    return [
        {
            description: 'Open a fresh Konteks session with project context.',
            name: 'konteks-warm-up',
            title: 'Warm Up',
        },
        {
            arguments: [
                {
                    description:
                        'The module, feature, file, decision, or constraint to recall.',
                    name: 'task',
                    required: true,
                },
            ],
            description:
                'Supplement a Build task with context from known project memory.',
            name: 'konteks-recall',
            title: 'Recall',
        },
        {
            arguments: [
                {
                    description:
                        'The existing feature, module, file, or behavior to change.',
                    name: 'task',
                    required: true,
                },
            ],
            description: 'Continue an existing task in the Build phase.',
            name: 'konteks-work-on-existing',
            title: 'Work On Existing',
        },
        {
            arguments: [
                {
                    description: 'The new task or feature to build.',
                    name: 'task',
                    required: true,
                },
            ],
            description: 'Start a new task in the Build phase.',
            name: 'konteks-work-on-new',
            title: 'Work On New',
        },
        {
            arguments: [
                {
                    description:
                        'Optional extra save instructions for the current task.',
                    name: 'task',
                    required: false,
                },
            ],
            description: 'Persist durable progress at the end of a task.',
            name: 'konteks-save',
            title: 'Save',
        },
    ]
}

function getPromptResult(
    prompt: Prompt,
    args: Record<string, string>,
): GetPromptResult {
    const task = args.task?.trim()
    return {
        description: prompt.description,
        messages: [
            {
                content: {
                    text: promptText(prompt.name, task),
                    type: 'text',
                },
                role: 'user',
            },
        ],
    }
}

function promptText(name: string, task: string | undefined): string {
    switch (name) {
        case 'konteks-warm-up':
            return 'Warm up this Konteks session. Call konteks_warm_up and summarize the project architecture, active constraints, and durable decisions.'
        case 'konteks-recall':
            return `Recall relevant Konteks context for this task: ${task ?? '<task>'}. Call konteks_recall before answering.`
        case 'konteks-work-on-existing':
            return `Build on this existing code or behavior: ${task ?? '<task>'}. Use Konteks context as needed, then propose and implement the change.`
        case 'konteks-work-on-new':
            return `Build this new task: ${task ?? '<task>'}. Discover relevant code during implementation and keep durable findings ready for save.`
        case 'konteks-save':
            return `Save this Konteks session. Call konteks_save with completed work, pending items, tradeoffs, tests run, and exact next steps${task ? ` for: ${task}` : ''}.`
        default:
            return ''
    }
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

type WarmUpContext = {
    architecture: string[]
    constraints: string[]
    durableDecisions: string[]
    keyFiles: string[]
    summary: string
    taxonomy: string[]
    technologies: string[]
}

async function assembleWarmUpContext(
    context: Awaited<ReturnType<typeof loadProjectContext>>,
    maxTokens: number | undefined,
): Promise<WarmUpContext> {
    const manifest = await readMineManifest(context.memoryDir)
    if (!manifest) {
        return {
            architecture: [],
            constraints: ['Run `konteks init` to initialize project memory.'],
            durableDecisions: [],
            keyFiles: [],
            summary: 'Konteks memory is not initialized yet.',
            taxonomy: [],
            technologies: [],
        }
    }

    const summaryText = await createToonStore(context.memoryDir)
        .read(manifest.summaryRef)
        .catch(() => '')
    const adapter = await openProjectDatabase(context)
    try {
        const modules = await adapter.query<{ path: string; summary: string }>(
            `
select path, summary
from modules
order by chunk_count desc, file_count desc
limit 8
`,
        )
        const decisions = await adapter.query<{ text_inline: string | null }>(
            `
select text_inline
from observations
where kind in ('decision', 'constraint', 'preference', 'fact')
  and deleted_at is null
  and suppressed_at is null
order by created_at desc
limit 12
`,
        )

        const summary = clipText(summaryText, Math.min(maxTokens ?? 800, 2200))
        return {
            architecture: modules.map(
                module => `${module.path}: ${module.summary}`,
            ),
            constraints: decisions
                .map(item => item.text_inline ?? '')
                .filter(Boolean)
                .slice(0, 8),
            durableDecisions: decisions
                .map(item => item.text_inline ?? '')
                .filter(Boolean)
                .slice(0, 8),
            keyFiles: manifest.files.slice(0, 12).map(file => file.path),
            summary:
                summary ||
                `Project extraction is available for ${manifest.fileCount} files.`,
            taxonomy: [],
            technologies: manifest.metadata.technologies,
        }
    } finally {
        await adapter.close()
    }
}

function clipText(text: string, maxTokens: number): string {
    if (!text.trim()) {
        return ''
    }
    const words = text.trim().split(/\s+/u)
    const budget = Math.max(80, Math.min(maxTokens, 4000))
    if (words.length <= budget) {
        return text.trim()
    }
    return `${words.slice(0, budget).join(' ')}...`
}

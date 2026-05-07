import { join } from 'node:path'
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
import {
    type SaveProjectUpdate,
    saveKonteksInput,
} from '../memory/save-store.js'
import {
    type MemorySearchResult,
    searchMemory,
} from '../memory/search-store.js'
import { readMineManifest } from '../mining/manifest.js'
import { mineProject } from '../mining/mine-project.js'
import { loadProjectContext, pathExists } from '../project/context.js'
import {
    openProjectDatabase,
    projectDatabasePath,
} from '../storage/database.js'
import type { SqliteAdapter } from '../storage/sqlite-adapter.js'
import {
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
import { listPromptDefinitions, renderPromptText } from './prompt-library.js'
import { textResult } from './result.js'
import {
    formatRecallText,
    formatSaveText,
    formatSearchText,
    formatWarmUpText,
} from './retrieval-format.js'

type StartMcpServerOptions = {
    memoryDir?: string
    project?: string
}

type FlexibleRegisterTool = (
    name: string,
    config: {
        annotations?: Tool['annotations']
        description: string
        inputSchema: Tool['inputSchema']
        outputSchema?: Tool['outputSchema']
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

const warmUpOutputSchema: Tool['outputSchema'] = {
    properties: {
        architecture: { items: { type: 'string' }, type: 'array' },
        constraints: { items: { type: 'string' }, type: 'array' },
        conventions: { items: { type: 'string' }, type: 'array' },
        description: { type: 'string' },
        durableDecisions: { items: { type: 'string' }, type: 'array' },
        entryPoints: { items: { type: 'string' }, type: 'array' },
        keyFiles: { items: { type: 'string' }, type: 'array' },
        project: { type: 'object' },
        summary: { type: 'string' },
        taxonomy: { items: { type: 'string' }, type: 'array' },
        technologies: { items: { type: 'string' }, type: 'array' },
    },
    required: [
        'summary',
        'technologies',
        'keyFiles',
        'architecture',
        'durableDecisions',
        'constraints',
        'conventions',
        'entryPoints',
        'taxonomy',
        'project',
    ],
    type: 'object',
}

const recallOutputSchema: Tool['outputSchema'] = {
    properties: {
        graph: { items: { type: 'object' }, type: 'array' },
        history: { items: { type: 'object' }, type: 'array' },
        memories: { items: { type: 'object' }, type: 'array' },
        task: { type: 'string' },
        tokenBudget: { type: 'number' },
    },
    required: ['task', 'tokenBudget', 'graph', 'history', 'memories'],
    type: 'object',
}

const searchOutputSchema: Tool['outputSchema'] = {
    properties: {
        limit: { type: 'number' },
        query: { type: 'string' },
        results: { items: { type: 'object' }, type: 'array' },
    },
    required: ['query', 'limit', 'results'],
    type: 'object',
}

const saveOutputSchema: Tool['outputSchema'] = {
    properties: {
        accepted: { type: 'boolean' },
        diaryId: { type: 'string' },
        duplicateOf: { type: 'string' },
        id: { type: 'string' },
        memoryIds: { items: { type: 'string' }, type: 'array' },
        skippedMemories: { type: 'number' },
        type: { type: 'string' },
    },
    required: ['accepted', 'id', 'type'],
    type: 'object',
}

const forgetOutputSchema: Tool['outputSchema'] = {
    properties: {
        accepted: { type: 'boolean' },
        affectedIds: { items: { type: 'string' }, type: 'array' },
        mode: { type: 'string' },
    },
    required: ['accepted', 'mode', 'affectedIds'],
    type: 'object',
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
                'Use prompts for the Warm Up -> Build -> Save flow. Use konteks_warm_up at session start, konteks_recall as supplemental Build context, and call konteks_save with structured durable memories plus one diary entry during Save.',
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
            outputSchema: config.outputSchema,
        })
    }

    registerKonteksTools(options, registerTool)

    const prompts = listPromptDefinitions()

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
            outputSchema: tool.outputSchema,
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
    outputSchema?: Tool['outputSchema']
}

function registerKonteksTools(
    options: StartMcpServerOptions,
    registerTool: FlexibleRegisterTool,
): void {
    registerTool(
        'konteks_warm_up',
        {
            annotations: {
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
                readOnlyHint: false,
            },
            description:
                'Load the stable project-wide briefing for the current repo.',
            inputSchema: warmUpInputSchema,
            outputSchema: warmUpOutputSchema,
        },
        async input => {
            parseWarmUpInput(input)
            const context = await loadMcpProjectContext(options)
            await validateMcpProjectHealth(context)
            await updateChangedProjectMemorySilently(context)
            const warmUp = await assembleWarmUpContext(context)
            const payload = {
                architecture: warmUp.architecture,
                constraints: warmUp.constraints,
                conventions: warmUp.conventions,
                description: warmUp.description,
                durableDecisions: warmUp.durableDecisions,
                entryPoints: warmUp.entryPoints,
                keyFiles: warmUp.keyFiles,
                project: {
                    memoryDir: context.memoryDir,
                    name: context.projectRoot.split('/').at(-1) ?? 'project',
                    root: context.projectRoot,
                },
                summary: warmUp.summary,
                taxonomy: warmUp.taxonomy,
                technologies: warmUp.technologies,
            }
            return textResult(
                payload,
                formatWarmUpText({
                    architecture: payload.architecture,
                    constraints: payload.constraints,
                    conventions: payload.conventions,
                    description: payload.description,
                    durableDecisions: payload.durableDecisions,
                    entryPoints: payload.entryPoints,
                    keyFiles: payload.keyFiles,
                    summary: payload.summary,
                    technologies: payload.technologies,
                }),
            )
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
            outputSchema: recallOutputSchema,
        },
        async input => {
            const parsed = parseRecallInput(input)
            await validateMcpProjectHealth(await loadMcpProjectContext(options))
            const recall = await withProjectDatabase(
                options,
                async adapter => ({
                    graph: await recallGraph(adapter, parsed.task),
                    history: await recallHistory(adapter, parsed.task),
                    memories: await searchMemory(adapter, parsed),
                }),
            )
            const payload = {
                graph: recall.graph,
                history: recall.history,
                memories: applyTokenBudget(
                    recall.memories,
                    parsed.maxTokens ?? 2000,
                ),
                task: parsed.task,
                tokenBudget: parsed.maxTokens ?? 2000,
            }
            return textResult(
                payload,
                formatRecallText({
                    graphCount: payload.graph.length,
                    graphEvidence: payload.graph
                        .slice(0, 6)
                        .map(
                            item =>
                                `${item.entityName} ${item.predicate} ${item.relatedEntityName} (depth=${item.depth})`,
                        ),
                    historyCount: payload.history.length,
                    historyEvidence: payload.history
                        .slice(0, 6)
                        .map(
                            item =>
                                `${item.subjectEntityName} ${item.predicate} ${item.objectEntityName} [${item.status}]`,
                        ),
                    memories: payload.memories,
                    task: payload.task,
                }),
            )
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
            outputSchema: searchOutputSchema,
        },
        async input => {
            const parsed = parseSearchInput(input)
            await validateMcpProjectHealth(await loadMcpProjectContext(options))
            const results = await withProjectDatabase(options, adapter =>
                searchMemory(adapter, parsed),
            )
            const payload = {
                limit: parsed.limit ?? 10,
                query: parsed.query,
                results,
            }
            return textResult(
                payload,
                formatSearchText({
                    limit: payload.limit,
                    query: payload.query,
                    results: payload.results,
                }),
            )
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
            description:
                'Persist structured durable memories or one session diary entry.',
            inputSchema: saveInputSchema,
            outputSchema: saveOutputSchema,
        },
        async input => {
            const parsed = parseSaveInput(input)
            const context = await loadMcpProjectContext(options)
            await validateMcpProjectHealth(context)
            const projectUpdate =
                await updateChangedProjectMemorySilently(context)
            const saved = await withProjectDatabaseContext(context, adapter =>
                saveKonteksInput(adapter, context, parsed, { projectUpdate }),
            )
            return textResult(
                saved,
                formatSaveText({
                    diaryId: saved.diaryId,
                    memoryIds: saved.memoryIds,
                    skippedMemories: saved.skippedMemories,
                }),
            )
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
            outputSchema: forgetOutputSchema,
        },
        async input => {
            const parsed = parseForgetInput(input)
            await validateMcpProjectHealth(await loadMcpProjectContext(options))
            const result = await withProjectDatabase(options, adapter =>
                forgetMemory(adapter, parsed),
            )
            return textResult(result)
        },
    )
}

export function listMcpPrompts(): Prompt[] {
    return listPromptDefinitions()
}

export function getMcpPrompt(
    name: string,
    args: Record<string, string> = {},
): GetPromptResult {
    const prompt = listPromptDefinitions().find(item => item.name === name)
    if (!prompt) {
        throw new Error(`Unknown Konteks prompt: ${name}`)
    }

    return getPromptResult(prompt, args)
}

export function listMcpTools(options: StartMcpServerOptions): Tool[] {
    return [...createToolRegistrations(options).values()].map(tool => ({
        annotations: tool.annotations,
        description: tool.description,
        inputSchema: tool.inputSchema,
        name: tool.name,
        outputSchema: tool.outputSchema,
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
            outputSchema: config.outputSchema,
        })
    }

    registerKonteksTools(options, registerTool)
    return tools
}

function getPromptResult(
    prompt: Prompt,
    args: Record<string, string>,
): GetPromptResult {
    return {
        description: prompt.description,
        messages: [
            {
                content: {
                    text: renderPromptText(prompt.name, args),
                    type: 'text',
                },
                role: 'user',
            },
        ],
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
    const context = await loadMcpProjectContext(options)
    return withProjectDatabaseContext(context, adapter =>
        operation(adapter, context),
    )
}

async function loadMcpProjectContext(
    options: StartMcpServerOptions,
): Promise<Awaited<ReturnType<typeof loadProjectContext>>> {
    const context = await loadProjectContext(options.project)
    if (!options.memoryDir) {
        return context
    }

    const configPath = join(options.memoryDir, 'config.json')
    return {
        ...context,
        configExists: await pathExists(configPath),
        configPath,
        memoryDir: options.memoryDir,
    }
}

async function withProjectDatabaseContext<T>(
    context: Awaited<ReturnType<typeof loadProjectContext>>,
    operation: (adapter: SqliteAdapter) => Promise<T>,
): Promise<T> {
    const adapter = await openProjectDatabase(context)

    try {
        return await operation(adapter)
    } finally {
        await adapter.close()
    }
}

async function validateMcpProjectHealth(
    context: Awaited<ReturnType<typeof loadProjectContext>>,
): Promise<void> {
    if (!context.configExists) {
        throw new Error(
            'Konteks memory is not initialized. Run `konteks init`.',
        )
    }
    if (!(await readMineManifest(context.memoryDir))) {
        throw new Error(
            'Konteks memory is missing extraction artifacts. Run `konteks repair`.',
        )
    }
    if (!(await pathExists(projectDatabasePath(context)))) {
        throw new Error(
            'Konteks memory database is missing. Run `konteks repair`.',
        )
    }
}

async function updateChangedProjectMemorySilently(
    context: Awaited<ReturnType<typeof loadProjectContext>>,
): Promise<SaveProjectUpdate | undefined> {
    if (!context.configExists || !(await readMineManifest(context.memoryDir))) {
        return undefined
    }

    const result = await mineProject(context, 'changed')
    return {
        deletedFilePaths: result.deletedFilePaths,
        updatedFilePaths: result.updatedFilePaths,
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
    conventions: string[]
    description?: string
    durableDecisions: string[]
    entryPoints: string[]
    keyFiles: string[]
    summary: string
    taxonomy: string[]
    technologies: string[]
}

async function assembleWarmUpContext(
    context: Awaited<ReturnType<typeof loadProjectContext>>,
): Promise<WarmUpContext> {
    const manifest = await readMineManifest(context.memoryDir)
    if (!manifest) {
        return {
            architecture: [],
            constraints: ['Run `konteks init` to initialize project memory.'],
            conventions: [],
            description: 'Konteks memory is not initialized yet.',
            durableDecisions: [],
            entryPoints: [],
            keyFiles: [],
            summary: 'Konteks memory is not initialized yet.',
            taxonomy: [],
            technologies: [],
        }
    }

    const adapter = await openProjectDatabase(context)
    try {
        const modules = await adapter.query<{
            path: string
            source_role: string | null
            summary: string
        }>(
            `
select path, source_role, summary
from modules
order by chunk_count desc, file_count desc
limit 12
`,
        )
        const observations = await adapter.query<{
            kind: string
            text_inline: string | null
        }>(
            `
select kind, text_inline
from observations
where deleted_at is null
  and suppressed_at is null
order by created_at desc
limit 40
`,
        )

        const filterKind = (kind: string): string[] =>
            observations
                .filter(item => item.kind === kind)
                .map(item => item.text_inline ?? '')
                .filter(Boolean)
                .slice(0, 10)

        return {
            architecture: modules.map(
                module =>
                    `${module.path}${module.source_role ? ` (${module.source_role})` : ''} :: ${module.summary}`,
            ),
            constraints: filterKind('constraint'),
            conventions: filterKind('preference'),
            description: manifest.metadata.description,
            durableDecisions: filterKind('decision'),
            entryPoints: manifest.metadata.entryPoints,
            keyFiles: manifest.files.slice(0, 12).map(file => file.path),
            summary: stableProjectSummary(manifest),
            taxonomy: [],
            technologies: manifest.metadata.technologies,
        }
    } finally {
        await adapter.close()
    }
}

function stableProjectSummary(
    manifest: NonNullable<Awaited<ReturnType<typeof readMineManifest>>>,
): string {
    const name = manifest.metadata.name ?? 'This project'
    const description = manifest.metadata.description
    const technologies = manifest.metadata.technologies.slice(0, 6).join(', ')
    const packageManager = manifest.metadata.packageManager

    if (description) {
        return `${name}: ${description}`
    }

    const details = [
        `${name} has ${manifest.fileCount} indexed files`,
        technologies ? `uses ${technologies}` : '',
        packageManager ? `uses ${packageManager}` : '',
    ].filter(Boolean)

    return `${details.join(', ')}.`
}

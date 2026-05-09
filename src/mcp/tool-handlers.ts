import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { encode } from '@toon-format/toon'
import type { z } from 'zod'
import { forgetMemory } from '../memory/forget-store.js'
import { saveKonteksInput } from '../memory/save-store.js'
import { searchMemory } from '../memory/search-store.js'
import type {
    KonteksMcpServer,
    RecallPackage,
    StartMcpServerOptions,
} from '../types/mcp.js'
import type {
    ForgetInput,
    RecallInput,
    SaveInput,
    SearchInput,
    WarmUpInput,
} from './inputs.js'
import {
    forgetInputSchema,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
    warmUpInputSchema,
} from './inputs.js'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    validateMcpProjectHealth,
    withProjectDatabase,
    withProjectDatabaseContext,
} from './project-runtime.js'
import {
    assembleRecallPackage,
    recallGraph,
    recallHistory,
} from './recall-package.js'
import {
    formatRecallText,
    formatSaveText,
    formatSearchText,
    formatWarmUpText,
} from './retrieval-format.js'
import { KONTEKS_TOOL_SURFACE } from './tool-surface.js'
import { assembleWarmUpContext, limitWarmUpContext } from './warm-up-context.js'

type ToolHandlers = Record<string, (input: unknown) => Promise<CallToolResult>>

export function registerKonteksTools(
    options: StartMcpServerOptions,
    server: KonteksMcpServer,
): void {
    const handlers = createToolHandlers(options)

    for (const surface of KONTEKS_TOOL_SURFACE) {
        const schema = inputSchemaForTool(surface.name)
        server.registerTool(
            surface.name,
            {
                annotations: surface.annotations,
                description: surface.description,
                // biome-ignore lint/suspicious/noExplicitAny: compatibility cast
                inputSchema: schema as any,
            },
            (input: unknown) => handlers[surface.name](input),
        )
    }
}

export function createToolHandlers(
    options: StartMcpServerOptions,
): ToolHandlers {
    return {
        konteks_forget: (input: unknown) =>
            handleForgetTool(options, input as ForgetInput),
        konteks_recall: (input: unknown) =>
            handleRecallTool(options, input as RecallInput),
        konteks_save: (input: unknown) =>
            handleSaveTool(options, input as SaveInput),
        konteks_search: (input: unknown) =>
            handleSearchTool(options, input as SearchInput),
        konteks_warm_up: (input: unknown) =>
            handleWarmUpTool(options, input as WarmUpInput),
    }
}

async function handleWarmUpTool(
    options: StartMcpServerOptions,
    input: WarmUpInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    await updateChangedProjectMemorySilently(context)
    const warmUp = limitWarmUpContext(
        await assembleWarmUpContext(context),
        input.maxTokens ?? 2000,
    )

    const recall = input.topic
        ? await focusedWarmUpRecall(options, input.topic, input.maxTokens)
        : undefined

    return formatToTextResult(formatWarmUpText({ recall, warmUp }))
}

async function focusedWarmUpRecall(
    options: StartMcpServerOptions,
    topic: string,
    maxTokens?: number,
): Promise<RecallPackage> {
    const memories = await withProjectDatabase(options, adapter =>
        searchMemory(adapter, { query: topic }),
    )
    return assembleRecallPackage({
        graph: [],
        history: [],
        includeSources: false,
        maxTokens: maxTokens ?? 2000,
        memories,
        task: topic,
    })
}

async function handleRecallTool(
    options: StartMcpServerOptions,
    input: RecallInput,
) {
    await validateMcpProjectHealth(await loadMcpProjectContext(options))
    const recall = await withProjectDatabase(options, async adapter => {
        const memories = await searchMemory(adapter, input)
        const graph = await recallGraph(adapter, input.task)
        const history = await recallHistory(adapter, input.task)
        return assembleRecallPackage({
            graph,
            history,
            includeSources: input.includeSources ?? false,
            maxTokens: input.maxTokens ?? 2000,
            memories,
            task: input.task,
        })
    })

    return formatToTextResult(
        formatRecallText({
            includeSources: input.includeSources ?? false,
            recall,
        }),
    )
}

async function handleSaveTool(
    options: StartMcpServerOptions,
    input: SaveInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    const saved = await withProjectDatabaseContext(context, adapter =>
        saveKonteksInput(adapter, context, input, { projectUpdate }),
    )
    return formatToTextResult(formatSaveText(saved))
}

async function handleSearchTool(
    options: StartMcpServerOptions,
    input: SearchInput,
) {
    await validateMcpProjectHealth(await loadMcpProjectContext(options))
    const results = await withProjectDatabase(options, adapter =>
        searchMemory(adapter, input),
    )
    return formatToTextResult(
        formatSearchText({
            limit: input.limit ?? 10,
            query: input.query,
            results,
        }),
    )
}

async function handleForgetTool(
    options: StartMcpServerOptions,
    input: ForgetInput,
) {
    await validateMcpProjectHealth(await loadMcpProjectContext(options))
    const result = await withProjectDatabase(options, adapter =>
        forgetMemory(adapter, input),
    )
    return formatToTextResult(result)
}

function formatToTextResult(value: string | object): CallToolResult {
    return {
        content: [
            {
                text: typeof value === 'string' ? value : encode(value),
                type: 'text' as const,
            },
        ],
    }
}

function inputSchemaForTool(name: string): z.ZodTypeAny {
    switch (name) {
        case 'konteks_warm_up':
            return warmUpInputSchema
        case 'konteks_recall':
            return recallInputSchema
        case 'konteks_save':
            return saveInputSchema
        case 'konteks_search':
            return searchInputSchema
        case 'konteks_forget':
            return forgetInputSchema
        default:
            throw new Error(`Unknown tool: ${name}`)
    }
}

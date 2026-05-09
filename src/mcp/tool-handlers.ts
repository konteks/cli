import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { encode } from '@toon-format/toon'
import { forgetMemory } from '../memory/forget-store.js'
import { saveKonteksInput } from '../memory/save-store.js'
import { searchMemory } from '../memory/search-store.js'
import type {
    FlexibleRegisterTool,
    RecallPackage,
    StartMcpServerOptions,
} from '../types/mcp.js'
import {
    parseForgetInput,
    parseRecallInput,
    parseSaveInput,
    parseSearchInput,
    parseWarmUpInput,
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
import {
    KONTEKS_TOOL_SURFACE,
    type KonteksToolName,
    toolRegistrationConfig,
} from './tool-surface.js'
import { assembleWarmUpContext, limitWarmUpContext } from './warm-up-context.js'

type ToolHandlers = Record<
    KonteksToolName,
    (input: unknown) => Promise<CallToolResult>
>

export function registerKonteksTools(
    options: StartMcpServerOptions,
    registerTool: FlexibleRegisterTool,
): void {
    const handlers = createToolHandlers(options)
    for (const surface of KONTEKS_TOOL_SURFACE) {
        registerTool(
            surface.name,
            toolRegistrationConfig(surface),
            handlers[surface.name],
        )
    }
}

function createToolHandlers(options: StartMcpServerOptions): ToolHandlers {
    return {
        konteks_forget: input => handleForgetTool(options, input),
        konteks_recall: input => handleRecallTool(options, input),
        konteks_save: input => handleSaveTool(options, input),
        konteks_search: input => handleSearchTool(options, input),
        konteks_warm_up: input => handleWarmUpTool(options, input),
    }
}

async function handleWarmUpTool(
    options: StartMcpServerOptions,
    input: unknown,
): Promise<CallToolResult> {
    const parsed = parseWarmUpInput(input)
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    await updateChangedProjectMemorySilently(context)
    const warmUp = limitWarmUpContext(
        await assembleWarmUpContext(context),
        parsed.maxTokens ?? 2000,
    )

    const recall = parsed.topic
        ? await focusedWarmUpRecall(options, parsed.topic, parsed.maxTokens)
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
    input: unknown,
): Promise<CallToolResult> {
    const parsed = parseRecallInput(input)
    await validateMcpProjectHealth(await loadMcpProjectContext(options))
    const recall = await withProjectDatabase(options, async adapter => {
        const memories = await searchMemory(adapter, parsed)
        const graph = await recallGraph(adapter, parsed.task)
        const history = await recallHistory(adapter, parsed.task)
        return assembleRecallPackage({
            graph,
            history,
            includeSources: parsed.includeSources ?? false,
            maxTokens: parsed.maxTokens ?? 2000,
            memories,
            task: parsed.task,
        })
    })

    return formatToTextResult(
        formatRecallText({
            includeSources: parsed.includeSources ?? false,
            recall,
        }),
    )
}

async function handleSaveTool(
    options: StartMcpServerOptions,
    input: unknown,
): Promise<CallToolResult> {
    const parsed = parseSaveInput(input)
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const projectUpdate = await updateChangedProjectMemorySilently(context)
    const saved = await withProjectDatabaseContext(context, adapter =>
        saveKonteksInput(adapter, context, parsed, { projectUpdate }),
    )
    return formatToTextResult(formatSaveText(saved))
}

async function handleSearchTool(
    options: StartMcpServerOptions,
    input: unknown,
): Promise<CallToolResult> {
    const parsed = parseSearchInput(input)
    await validateMcpProjectHealth(await loadMcpProjectContext(options))
    const results = await withProjectDatabase(options, adapter =>
        searchMemory(adapter, parsed),
    )
    return formatToTextResult(
        formatSearchText({
            limit: parsed.limit ?? 10,
            query: parsed.query,
            results,
        }),
    )
}

async function handleForgetTool(
    options: StartMcpServerOptions,
    input: unknown,
): Promise<CallToolResult> {
    const parsed = parseForgetInput(input)
    await validateMcpProjectHealth(await loadMcpProjectContext(options))
    const result = await withProjectDatabase(options, adapter =>
        forgetMemory(adapter, parsed),
    )
    return formatToTextResult(result)
}

/**
 * @see https://modelcontextprotocol.io/specification/2025-11-25/server/tools#tool-result
 */
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

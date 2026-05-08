import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { forgetMemory } from '../memory/forget-store.js'
import { saveKonteksInput } from '../memory/save-store.js'
import { searchMemory } from '../memory/search-store.js'
import type {
    FlexibleRegisterTool,
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
    projectDescriptor,
    updateChangedProjectMemorySilently,
    validateMcpProjectHealth,
    withProjectDatabase,
    withProjectDatabaseContext,
} from './project-runtime.js'
import {
    assembleRecallPackage,
    graphEvidenceLines,
    historyEvidenceLines,
    recallGraph,
    recallHistory,
} from './recall-package.js'
import { textResult } from './result.js'
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
    const payload = {
        architecture: warmUp.architecture,
        constraints: warmUp.constraints,
        conventions: warmUp.conventions,
        description: warmUp.description,
        durableDecisions: warmUp.durableDecisions,
        entryPoints: warmUp.entryPoints,
        keyFiles: warmUp.keyFiles,
        project: projectDescriptor(context),
        recall,
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
            recall: payload.recall,
            summary: payload.summary,
            technologies: payload.technologies,
        }),
    )
}

async function focusedWarmUpRecall(
    options: StartMcpServerOptions,
    topic: string,
    maxTokens?: number,
): Promise<NonNullable<Parameters<typeof formatWarmUpText>[0]['recall']>> {
    const memories = await withProjectDatabase(options, adapter =>
        searchMemory(adapter, { query: topic }),
    )
    const recall = assembleRecallPackage({
        graph: [],
        history: [],
        includeSources: false,
        maxTokens: maxTokens ?? 2000,
        memories,
        task: topic,
    })
    return {
        brief: recall.brief,
        memories: recall.memories,
        primaryTargets: recall.primaryTargets,
        quality: recall.quality,
        sourceCount: recall.sourceCount,
        task: recall.task,
    }
}

async function handleRecallTool(
    options: StartMcpServerOptions,
    input: unknown,
): Promise<CallToolResult> {
    const parsed = parseRecallInput(input)
    await validateMcpProjectHealth(await loadMcpProjectContext(options))
    const recall = await withProjectDatabase(options, async adapter => ({
        graph: await recallGraph(adapter, parsed.task),
        history: await recallHistory(adapter, parsed.task),
        memories: await searchMemory(adapter, parsed),
    }))
    const payload = assembleRecallPackage({
        graph: recall.graph,
        history: recall.history,
        includeSources: parsed.includeSources ?? false,
        maxTokens: parsed.maxTokens ?? 2000,
        memories: recall.memories,
        task: parsed.task,
    })
    return textResult(
        payload,
        formatRecallText({
            brief: payload.brief,
            graphCount: payload.graph.length,
            graphEvidence: graphEvidenceLines(payload.graph),
            historyCount: payload.history.length,
            historyEvidence: historyEvidenceLines(payload.history),
            includeSources: parsed.includeSources ?? false,
            memories: payload.memories,
            primaryTargets: payload.primaryTargets,
            task: payload.task,
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
    return textResult(
        saved,
        formatSaveText({
            diaryId: saved.diaryId,
            memoryIds: saved.memoryIds,
            skippedMemories: saved.skippedMemories,
        }),
    )
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
    return textResult(result)
}

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { encode } from '@toon-format/toon'
import { ForgetMemoryUseCase } from '@/application/use-cases/forget-memory-use-case.js'
import { RecallMemoryUseCase } from '@/application/use-cases/recall-memory-use-case.js'
import { SaveMemoryUseCase } from '@/application/use-cases/save-memory-use-case.js' // Fix: was .ts in plan but should be .js for runtime if using tsc, but here we are in source.
import { SearchMemoryUseCase } from '@/application/use-cases/search-memory-use-case.js'
import { WarmUpUseCase } from '@/application/use-cases/warm-up-use-case.js'
import { SQLiteMemoryRepository } from '@/infrastructure/persistence/sqlite/sqlite-memory-repository.js'
import type { KonteksMcpServer, StartMcpServerOptions } from '@/types/mcp.js'
import type {
    ForgetInput,
    RecallInput,
    SaveInput,
    SearchInput,
    WarmUpInput,
} from './inputs.js'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
    validateMcpProjectHealth,
    withProjectDatabase,
    withProjectDatabaseContext,
} from './project-runtime.js'
import {
    formatRecallText,
    formatSaveText,
    formatSearchText,
    formatWarmUpText,
} from './retrieval-format.js'
import { KONTEKS_TOOL_SURFACE } from './tool-surface.js'

type ToolHandlers = Record<string, (input: unknown) => Promise<CallToolResult>>

export function registerKonteksTools(
    options: StartMcpServerOptions,
    server: KonteksMcpServer,
): void {
    const handlers = createToolHandlers(options)

    for (const surface of KONTEKS_TOOL_SURFACE) {
        server.registerTool(
            surface.name,
            {
                annotations: surface.annotations,
                description: surface.description,
                // biome-ignore lint/suspicious/noExplicitAny: compatibility cast
                inputSchema: surface.inputSchema as any,
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

    const result = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const useCase = new WarmUpUseCase(context, repo)
        return useCase.execute(input)
    })

    return formatToTextResult(formatWarmUpText(result))
}

async function handleRecallTool(
    options: StartMcpServerOptions,
    input: RecallInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const recall = await withProjectDatabase(options, async service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const useCase = new RecallMemoryUseCase(repo)
        return useCase.execute(input)
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
    const saved = await withProjectDatabaseContext(context, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const useCase = new SaveMemoryUseCase(repo)
        return useCase.execute(input, { projectUpdate })
    })
    return formatToTextResult(formatSaveText(saved))
}

async function handleSearchTool(
    options: StartMcpServerOptions,
    input: SearchInput,
) {
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const results = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const useCase = new SearchMemoryUseCase(repo)
        return useCase.execute(input)
    })
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
    const context = await loadMcpProjectContext(options)
    await validateMcpProjectHealth(context)
    const result = await withProjectDatabase(options, service => {
        const repo = new SQLiteMemoryRepository(service, context)
        const useCase = new ForgetMemoryUseCase(repo)
        return useCase.execute(input)
    })
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

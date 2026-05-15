import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod'
import forgetMemory from '@/memory/forget-memory'
import { recallMemory } from '@/memory/recall'
import saveMemory from '@/memory/save-memory'
import searchMemory from '@/memory/search-memory'
import warmUpMemory from '@/memory/warm-up-memory'
import type { StartMcpServerOptions } from '@/models/mcp'
import formatToTextResult from '@/providers/protocol/format-to-text-result'
import {
    forgetInputSchema,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
    warmUpInputSchema,
} from '@/providers/protocol/inputs'
import {
    formatRecallText,
    formatSaveText,
    formatSearchText,
    formatWarmUpText,
} from '@/providers/protocol/retrieval-format'

export type ToolHandlers = Record<
    string,
    (input: unknown) => Promise<CallToolResult>
>

export async function callKonteksTool(
    options: StartMcpServerOptions,
    name: string,
    input: unknown = {},
): Promise<CallToolResult> {
    const schema = inputSchemaForTool(name)
    const validated = schema.parse(input)

    const handlers = createToolHandlers(options)
    const handler = handlers[name]
    if (!handler) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    return await handler(validated)
}

export function createToolHandlers(
    options: StartMcpServerOptions,
): ToolHandlers {
    return {
        konteks_forget: async input =>
            formatToTextResult(
                await forgetMemory(options, forgetInputSchema.parse(input)),
            ),
        konteks_recall: async input => {
            const parsed = recallInputSchema.parse(input)
            return formatToTextResult(
                formatRecallText({
                    includeSources: parsed.includeSources ?? false,
                    recall: await recallMemory(options, parsed),
                }),
            )
        },
        konteks_save: async input =>
            formatToTextResult(
                formatSaveText(
                    await saveMemory(options, saveInputSchema.parse(input)),
                ),
            ),
        konteks_search: async input => {
            const parsed = searchInputSchema.parse(input)
            return formatToTextResult(
                formatSearchText({
                    limit: parsed.limit ?? 10,
                    query: parsed.query,
                    results: await searchMemory(options, parsed),
                }),
            )
        },
        konteks_warm_up: async input =>
            formatToTextResult(
                formatWarmUpText(
                    await warmUpMemory(options, warmUpInputSchema.parse(input)),
                ),
            ),
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

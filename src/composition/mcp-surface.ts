import type {
    CallToolResult,
    Prompt,
    Tool,
} from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod'
import {
    forgetInputSchema,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
    warmUpInputSchema,
} from '@/app/providers/protocol/inputs'
import type { PromptTemplate } from '@/app/providers/protocol/prompt-templates'
import {
    getPromptTemplates,
    renderPromptTemplate,
} from '@/app/providers/protocol/prompt-templates'
import { formatToTextResult } from '@/app/providers/protocol/result'
import {
    formatRecallText,
    formatSaveText,
    formatSearchText,
    formatWarmUpText,
} from '@/app/providers/protocol/retrieval-format'
import { KONTEKS_TOOL_SURFACE } from '@/app/providers/protocol/tool-surface'
import type { StartMcpServerOptions } from '@/app/providers/protocol/types'
import {
    forgetMemory,
    recallMemory,
    saveMemory,
    searchMemory,
    warmUpMemory,
} from '@/composition/memory-operations'

export type ToolHandlers = Record<
    string,
    (input: unknown) => Promise<CallToolResult>
>

export function listKonteksPrompts(): Prompt[] {
    return getPromptTemplates().map(template => template.prompt)
}

export function getKonteksPrompt(
    name: string,
    args: Record<string, string> = {},
): {
    description?: string
    messages: Array<{ content: { text: string; type: 'text' }; role: 'user' }>
} {
    const template = promptTemplateByName(name)

    return {
        description: template.prompt.description,
        messages: [
            {
                content: {
                    text: renderPromptTemplate(template, args),
                    type: 'text',
                },
                role: 'user',
            },
        ],
    }
}

export function listKonteksTools(): Tool[] {
    return KONTEKS_TOOL_SURFACE.map(surface => ({
        description: surface.description,
        inputSchema: {
            properties: {},
            type: 'object',
        },
        name: surface.name,
    }))
}

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

function promptTemplateByName(name: string): PromptTemplate {
    const template = getPromptTemplates().find(
        item => item.prompt.name === name,
    )
    if (!template) {
        throw new Error(`Unknown Konteks prompt: ${name}`)
    }
    return template
}

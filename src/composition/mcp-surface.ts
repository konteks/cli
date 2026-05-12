import type {
    CallToolResult,
    Prompt,
    Tool,
} from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod'
import {
    forgetMemory,
    recallMemory,
    saveMemory,
    searchMemory,
    warmUpMemory,
} from '@/composition/memory-operations'
import type { StartMcpServerOptions } from '@/models/mcp'
import {
    forgetInputSchema,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
    warmUpInputSchema,
} from '@/providers/protocol/inputs'
import type { PromptTemplate } from '@/providers/protocol/prompt-templates'
import {
    getPromptTemplates,
    renderPromptTemplate,
} from '@/providers/protocol/prompt-templates'
import { formatToTextResult } from '@/providers/protocol/result'
import {
    formatRecallText,
    formatSaveText,
    formatSearchText,
    formatWarmUpText,
} from '@/providers/protocol/retrieval-format'
import {
    KONTEKS_TOOL_SURFACE,
    MCP_INSTRUCTIONS,
} from '@/providers/protocol/tool-surface'

export type ToolHandlers = Record<
    string,
    (input: unknown) => Promise<CallToolResult>
>

export type KonteksPromptRegistration = {
    args: NonNullable<Prompt['arguments']>
    description?: string
    name: string
    render(args: Record<string, string>): {
        messages: Array<{
            content: { text: string; type: 'text' }
            role: 'user'
        }>
    }
}

export type KonteksToolRegistration = {
    annotations: Tool['annotations']
    description: string
    inputSchema: z.ZodTypeAny
    name: string
}

export function getKonteksMcpInstructions(): string {
    return MCP_INSTRUCTIONS
}

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

export function getKonteksToolRegistrations(): KonteksToolRegistration[] {
    return KONTEKS_TOOL_SURFACE.map(surface => ({
        annotations: surface.annotations,
        description: surface.description,
        inputSchema: surface.inputSchema,
        name: surface.name,
    }))
}

export function getKonteksPromptRegistrations(): KonteksPromptRegistration[] {
    return getPromptTemplates().map(template => ({
        args: template.prompt.arguments ?? [],
        description: template.prompt.description,
        name: template.prompt.name,
        render: (args: Record<string, string>) => ({
            messages: [
                {
                    content: {
                        text: renderPromptTemplate(template, args),
                        type: 'text',
                    },
                    role: 'user',
                },
            ],
        }),
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

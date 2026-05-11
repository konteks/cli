import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type {
    CallToolResult,
    Prompt,
    Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import {
    forgetInputSchema,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
    warmUpInputSchema,
} from '@/interfaces/mcp/inputs'
import {
    KONTEKS_TOOL_SURFACE,
    MCP_INSTRUCTIONS,
} from '@/interfaces/mcp/tool-surface'
import type {
    KonteksMcpServer,
    StartMcpServerOptions,
} from '@/interfaces/mcp/types'
import { VERSION } from '@/utils/version'
import { recallPrompt } from './prompts/recall'
import { savePrompt } from './prompts/save'
import type { PromptTemplate } from './prompts/template'
import { renderPromptTemplate } from './prompts/template'
import { warmUpPrompt } from './prompts/warm-up'
import { workOnExistingPrompt } from './prompts/work-on-existing'
import { workOnNewPrompt } from './prompts/work-on-new'
import { handleForgetTool } from './tools/forget'
import { handleRecallTool } from './tools/recall'
import { handleSaveTool } from './tools/save'
import { handleSearchTool } from './tools/search'
import { handleWarmUpTool } from './tools/warm-up'

type ToolHandlers = Record<string, (input: unknown) => Promise<CallToolResult>>

const promptTemplates = [
    warmUpPrompt,
    recallPrompt,
    workOnExistingPrompt,
    workOnNewPrompt,
    savePrompt,
]

export async function startMcpServer(
    options: StartMcpServerOptions,
): Promise<void> {
    const server = createMcpServer(options)
    const transport = new StdioServerTransport()
    await server.connect(transport)
}

export function listMcpPrompts(): Prompt[] {
    return promptTemplates.map(template => template.prompt)
}

export function listCanonicalPromptFiles(): Array<{
    content: string
    fileName: string
}> {
    return promptTemplates.map(template => ({
        content: template.raw,
        fileName: template.fileName,
    }))
}

export function getMcpPrompt(
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

export function listMcpTools(): Tool[] {
    return KONTEKS_TOOL_SURFACE.map(surface => ({
        description: surface.description,
        inputSchema: {
            properties: {},
            type: 'object',
        },
        name: surface.name,
    }))
}

export async function callMcpTool(
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

function registerKonteksTools(
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

function createToolHandlers(options: StartMcpServerOptions): ToolHandlers {
    return {
        konteks_forget: (input: unknown) =>
            handleForgetTool(options, forgetInputSchema.parse(input)),
        konteks_recall: (input: unknown) =>
            handleRecallTool(options, recallInputSchema.parse(input)),
        konteks_save: (input: unknown) =>
            handleSaveTool(options, saveInputSchema.parse(input)),
        konteks_search: (input: unknown) =>
            handleSearchTool(options, searchInputSchema.parse(input)),
        konteks_warm_up: (input: unknown) =>
            handleWarmUpTool(options, warmUpInputSchema.parse(input)),
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

function createMcpServer(options: StartMcpServerOptions): McpServer {
    const server = new McpServer(
        {
            name: 'konteks',
            version: VERSION,
        },
        {
            instructions: MCP_INSTRUCTIONS,
        },
    )

    registerKonteksTools(options, server)
    registerKonteksPrompts(server)

    return server
}

function registerKonteksPrompts(server: McpServer): void {
    for (const template of promptTemplates) {
        const argsSchema: Record<string, z.ZodTypeAny> = {}
        for (const arg of template.prompt.arguments ?? []) {
            let schema: z.ZodTypeAny = z
                .string()
                .describe(arg.description ?? '')
            if (!arg.required) {
                schema = schema.optional()
            }
            argsSchema[arg.name] = schema
        }

        server.registerPrompt(
            template.prompt.name,
            {
                // biome-ignore lint/suspicious/noExplicitAny: compatibility cast
                argsSchema: argsSchema as any,
                description: template.prompt.description,
            },
            (args: Record<string, string>) => ({
                messages: [
                    {
                        content: {
                            text: renderPromptTemplate(template, args),
                            type: 'text' as const,
                        },
                        role: 'user' as const,
                    },
                ],
            }),
        )
    }
}

function promptTemplateByName(name: string): PromptTemplate {
    const template = promptTemplates.find(item => item.prompt.name === name)
    if (!template) {
        throw new Error(`Unknown Konteks prompt: ${name}`)
    }
    return template
}

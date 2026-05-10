import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type {
    CallToolResult,
    Prompt,
    Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { StartMcpServerOptions } from '@/interfaces/mcp/types.js'
import { VERSION } from '@/utils/version.js'
import {
    forgetInputSchema,
    recallInputSchema,
    saveInputSchema,
    searchInputSchema,
    warmUpInputSchema,
} from './inputs.js'
import { listPromptDefinitions, renderPromptText } from './prompt-library.js'
import { createToolHandlers, registerKonteksTools } from './tool-handlers.js'
import { KONTEKS_TOOL_SURFACE, MCP_INSTRUCTIONS } from './tool-surface.js'

export { createToolHandlers }

export async function startMcpServer(
    options: StartMcpServerOptions,
): Promise<void> {
    const server = createMcpServer(options)
    const transport = new StdioServerTransport()
    await server.connect(transport)
}

export function listMcpPrompts(): Prompt[] {
    return listPromptDefinitions()
}

export function getMcpPrompt(
    name: string,
    args: Record<string, string> = {},
): {
    description?: string
    messages: Array<{ content: { text: string; type: 'text' }; role: 'user' }>
} {
    const prompt = listPromptDefinitions().find(item => item.name === name)
    if (!prompt) {
        throw new Error(`Unknown Konteks prompt: ${name}`)
    }

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

    // Register Tools
    registerKonteksTools(options, server)

    // Register Prompts
    for (const definition of listPromptDefinitions()) {
        const argsSchema: Record<string, z.ZodTypeAny> = {}
        for (const arg of definition.arguments ?? []) {
            let schema: z.ZodTypeAny = z
                .string()
                .describe(arg.description ?? '')
            if (!arg.required) {
                schema = schema.optional()
            }
            argsSchema[arg.name] = schema
        }

        server.registerPrompt(
            definition.name,
            {
                // biome-ignore lint/suspicious/noExplicitAny: compatibility cast
                argsSchema: argsSchema as any,
                description: definition.description,
            },
            (args: Record<string, string>) => ({
                messages: [
                    {
                        content: {
                            text: renderPromptText(definition.name, args),
                            type: 'text' as const,
                        },
                        role: 'user' as const,
                    },
                ],
            }),
        )
    }

    return server
}

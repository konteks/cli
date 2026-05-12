import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
    getPromptTemplates,
    renderPromptTemplate,
} from '@/app/providers/protocol/prompt-templates'
import {
    KONTEKS_TOOL_SURFACE,
    MCP_INSTRUCTIONS,
} from '@/app/providers/protocol/tool-surface'
import type {
    KonteksMcpServer,
    StartMcpServerOptions,
} from '@/app/providers/protocol/types'
import { createToolHandlers } from '@/composition/mcp-surface'
import { VERSION } from '@/support/version'

export async function startMcpServer(
    options: StartMcpServerOptions,
): Promise<void> {
    const server = createMcpServer(options)
    const transport = new StdioServerTransport()
    await server.connect(transport)
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
    for (const template of getPromptTemplates()) {
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

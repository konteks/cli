import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
    createToolHandlers,
    getKonteksMcpInstructions,
    getKonteksPromptRegistrations,
    getKonteksToolRegistrations,
} from '@/composition/mcp-surface'
import type { StartMcpServerOptions } from '@/models/mcp'
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
    server: McpServer,
): void {
    const handlers = createToolHandlers(options)

    for (const surface of getKonteksToolRegistrations()) {
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
            instructions: getKonteksMcpInstructions(),
        },
    )

    registerKonteksTools(options, server)
    registerKonteksPrompts(server)

    return server
}

function registerKonteksPrompts(server: McpServer): void {
    for (const template of getKonteksPromptRegistrations()) {
        const argsSchema: Record<string, z.ZodTypeAny> = {}
        for (const arg of template.args) {
            let schema: z.ZodTypeAny = z
                .string()
                .describe(arg.description ?? '')
            if (!arg.required) {
                schema = schema.optional()
            }
            argsSchema[arg.name] = schema
        }

        server.registerPrompt(
            template.name,
            {
                // biome-ignore lint/suspicious/noExplicitAny: compatibility cast
                argsSchema: argsSchema as any,
                description: template.description,
            },
            (args: Record<string, string>) => template.render(args),
        )
    }
}

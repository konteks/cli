import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import z from 'zod'
import { createToolHandlers } from '@/mcp/handlers'
import { getKonteksPromptRegistrations } from '@/mcp/prompts'
import {
    getKonteksMcpInstructions,
    getKonteksToolRegistrations,
} from '@/mcp/tools'
import type { StartMcpServerOptions } from '@/models/mcp'
import { VERSION } from '@/support/version'

export default async function startMcpServer(
    options: StartMcpServerOptions,
): Promise<void> {
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

    await server.connect(new StdioServerTransport())
}

function registerKonteksTools(
    options: StartMcpServerOptions,
    server: McpServer,
): void {
    const handlers = createToolHandlers(options)

    getKonteksToolRegistrations().forEach(tool => {
        server.registerTool(
            tool.name,
            {
                annotations: tool.annotations,
                description: tool.description,
                // biome-ignore lint/suspicious/noExplicitAny: compatibility cast
                inputSchema: tool.inputSchema as any,
            },
            (input: unknown) => handlers[tool.name](input),
        )
    })
}

function registerKonteksPrompts(server: McpServer): void {
    getKonteksPromptRegistrations().forEach(template => {
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
    })
}

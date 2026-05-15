import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import type {
    BaseCommandContext,
    BaseCommandInput,
    BaseCommandRegistrar,
    Command,
} from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { createToolHandlers } from '@/mcp/handlers'
import { getKonteksPromptRegistrations } from '@/mcp/prompts'
import {
    getKonteksMcpInstructions,
    getKonteksToolRegistrations,
} from '@/mcp/tools'
import type { StartMcpServerOptions } from '@/models/mcp'
import { VERSION } from '@/support/version'
import CallCommand from './mcp/call-command'
import PromptCommand from './mcp/prompt-command'
import PromptsCommand from './mcp/prompts-command'
import ToolCommand from './mcp/tool-command'
import ToolsCommand from './mcp/tools-command'

export default class McpCommand extends BaseCommand {
    constructor(
        private readonly children: BaseCommandRegistrar[] = [
            new ToolsCommand(),
            new ToolCommand(),
            new PromptsCommand(),
            new PromptCommand(),
            new CallCommand(),
        ],
    ) {
        super({
            description: 'Start the MCP server or run MCP debug commands.',
            name: 'mcp',
        })
    }

    override register(parent: Command, context: BaseCommandContext): Command {
        const command = super.register(parent, context)
        for (const child of this.children) {
            child.register(command, context)
        }
        return command
    }

    override async handle({ globalOptions }: BaseCommandInput): Promise<void> {
        await startMcpServer({ project: globalOptions.project })
    }
}

async function startMcpServer(options: StartMcpServerOptions): Promise<void> {
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

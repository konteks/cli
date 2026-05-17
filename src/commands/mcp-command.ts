import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import z from 'zod'
import BaseCommand from '@/commands/_base-command'
import { createMcpPromptError } from '@/mcp/error-handling'
import { getKonteksPromptRegistrations } from '@/mcp/prompts'
import mcpTools from '@/mcp/tools'
import { VERSION } from '@/support/version'
import CallCommand from './mcp/call-command'
import PromptCommand from './mcp/prompt-command'
import PromptsCommand from './mcp/prompts-command'
import ToolCommand from './mcp/tool-command'
import ToolsCommand from './mcp/tools-command'

const MCP_INSTRUCTIONS =
    'Use prompts for the Warm Up -> Build -> Save flow. Use konteks_warm_up at session start, konteks_recall as supplemental Build context, then call konteks_save_memories for durable memory and konteks_save_diary for the session handoff during Save.'

export default class McpCommand extends BaseCommand {
    public override readonly children = [
        new ToolsCommand(),
        new ToolCommand(),
        new PromptsCommand(),
        new PromptCommand(),
        new CallCommand(),
    ]
    public readonly description =
        'Start the MCP server or run MCP debug commands.'
    public readonly name = 'mcp'
    public override readonly printsHeader = false

    public async handle(): Promise<void> {
        await startMcpServer()
    }
}

async function startMcpServer(): Promise<void> {
    const server = new McpServer(
        {
            name: 'konteks',
            version: VERSION,
        },
        {
            instructions: MCP_INSTRUCTIONS,
        },
    )

    mcpTools.forEach(mpcTool => {
        server.registerTool(
            mpcTool.name,
            {
                annotations: mpcTool.annotations,
                description: mpcTool.description,
                // biome-ignore lint/suspicious/noExplicitAny: compatibility cast
                inputSchema: mpcTool.inputSchema as any,
            },
            (input: unknown) => mpcTool.handle(input),
        )
    })

    registerMcpPrompts(server)

    const transport = new StdioServerTransport()
    await server.connect(transport)
}

function registerMcpPrompts(server: McpServer): void {
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
            (args: Record<string, string>) => {
                try {
                    return template.render(args)
                } catch (error) {
                    throw createMcpPromptError({
                        error,
                        promptName: template.name,
                    })
                }
            },
        )
    })
}

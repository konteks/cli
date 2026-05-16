import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import z from 'zod'
import { getKonteksPromptRegistrations } from '@/mcp/prompts'
import mcpTools from '@/mcp/tools'
import type { StartMcpServerOptions } from '@/models/mcp'
import { VERSION } from '@/support/version'

const MCP_INSTRUCTIONS =
    'Use prompts for the Warm Up -> Build -> Save flow. Use konteks_warm_up at session start, konteks_recall as supplemental Build context, then call konteks_save_memories for durable memory and konteks_save_diary for the session handoff during Save.'

export default async function startMcpServer(
    options: StartMcpServerOptions,
): Promise<void> {
    const server = new McpServer(
        {
            name: 'konteks',
            version: VERSION,
        },
        {
            instructions: MCP_INSTRUCTIONS,
        },
    )

    /**
     * REGISTER MCP TOOLS
     */
    mcpTools.forEach(mpcTool => {
        server.registerTool(
            mpcTool.name,
            {
                annotations: mpcTool.annotations,
                description: mpcTool.description,
                // biome-ignore lint/suspicious/noExplicitAny: compatibility cast
                inputSchema: mpcTool.inputSchema as any,
            },
            (input: unknown) => mpcTool.handle(options, input),
        )
    })

    /**
     * REGISTER MCP PROMPTS
     */
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
            (args: Record<string, string>) => template.render(args),
        )
    })
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerKonteksPrompts } from '@/entrypoints/mcp/prompts'
import mcpTools from '@/entrypoints/mcp/tools'
import getVersion from '@/support/get-version'
import BaseCommand from '../_base-command'
import ToolsCommand from './tools-command'

const MCP_INSTRUCTIONS =
    'Use prompts for the Warm Up -> Build -> Save flow. Use konteks_warm_up at session start, konteks_recall as supplemental Build context, then call konteks_save_memories for durable memory and konteks_save_diary for the session diary during Save.'

export default class McpCommand extends BaseCommand {
    public override readonly children = [new ToolsCommand()]
    public readonly description =
        'Start the MCP server or run MCP debug commands.'
    public readonly name = 'mcp'
    public override readonly printsHeader = false

    public async handle(): Promise<void> {
        const server = new McpServer(
            {
                name: 'konteks',
                version: getVersion(),
            },
            {
                instructions: MCP_INSTRUCTIONS,
            },
        )

        mcpTools.forEach(mpcTool => {
            mpcTool.register(server)
        })

        registerKonteksPrompts(server)

        const transport = new StdioServerTransport()
        await server.connect(transport)
    }
}

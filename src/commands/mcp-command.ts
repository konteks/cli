import BaseCommand from '@/commands/_base-command'
import startMcpServer from '@/mcp/start-mcp-server'
import CallCommand from './mcp/call-command'
import PromptCommand from './mcp/prompt-command'
import PromptsCommand from './mcp/prompts-command'
import ToolCommand from './mcp/tool-command'
import ToolsCommand from './mcp/tools-command'

export default class McpCommand extends BaseCommand {
    override readonly children = [
        new ToolsCommand(),
        new ToolCommand(),
        new PromptsCommand(),
        new PromptCommand(),
        new CallCommand(),
    ]
    readonly description = 'Start the MCP server or run MCP debug commands.'
    readonly name = 'mcp'
    override readonly printsHeader = false

    async handle(): Promise<void> {
        await startMcpServer()
    }
}

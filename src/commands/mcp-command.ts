import type {
    BaseCommandContext,
    BaseCommandInput,
    BaseCommandRegistrar,
    Command,
} from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import startMcpServer from '@/mcp/start-mcp-server'
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

        this.children.map(child => child.register(command, context))

        return command
    }

    override async handle({ globalOptions }: BaseCommandInput): Promise<void> {
        await startMcpServer({ project: globalOptions.project })
    }
}

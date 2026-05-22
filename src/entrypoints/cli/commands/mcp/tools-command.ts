import mcpTools from '@/entrypoints/mcp/tools'
import printJson from '@/support/cli/print-json'
import type { BaseCommandInput } from '../_base-command'
import BaseCommand from '../_base-command'

export default class ToolsCommand extends BaseCommand {
    public readonly description = 'List MCP tools exposed by Konteks.'
    public readonly name = 'tools'

    public async handle(_input: BaseCommandInput): Promise<void> {
        printJson(mcpTools)
    }
}

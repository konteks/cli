import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import mcpTools from '@/mcp/tools'
import printJson from '@/support/cli/print-json'

export default class ToolsCommand extends BaseCommand {
    constructor() {
        super({
            description: 'List MCP tools exposed by Konteks.',
            name: 'tools',
        })
    }

    override async handle(_input: BaseCommandInput): Promise<void> {
        printJson(mcpTools)
    }
}

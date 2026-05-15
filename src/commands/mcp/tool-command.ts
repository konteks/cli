import type { BaseCommandInput, Command } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import mcpTools from '@/mcp/tools'
import printJson from '@/support/cli/print-json'

export default class ToolCommand extends BaseCommand<[string]> {
    constructor() {
        super({
            description: 'Show one MCP tool exposed by Konteks.',
            name: 'tool',
        })
    }

    protected override configure(command: Command): void {
        command.argument('<name>', 'MCP tool name, such as konteks_warm_up')
    }

    override async handle({ args }: BaseCommandInput<[string]>): Promise<void> {
        const tool = mcpTools.find(item => item.name === args[0])

        if (!tool) {
            throw new Error(`Unknown Konteks tool: ${args[0]}`)
        }

        printJson(tool)
    }
}

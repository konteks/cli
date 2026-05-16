import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import mcpTools from '@/mcp/tools'
import printJson from '@/support/cli/print-json'

export default class ToolCommand extends BaseCommand<[string]> {
    override readonly args = [
        {
            description: 'MCP tool name, such as konteks_warm_up',
            name: '<name>',
        },
    ]
    readonly description = 'Show one MCP tool exposed by Konteks.'
    readonly name = 'tool'

    async handle({ args }: BaseCommandInput<[string]>): Promise<void> {
        const tool = mcpTools.find(item => item.name === args[0])

        if (!tool) {
            throw new Error(`Unknown Konteks tool: ${args[0]}`)
        }

        printJson(tool)
    }
}

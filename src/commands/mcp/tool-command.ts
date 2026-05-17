import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import mcpTools from '@/mcp/tools'
import printJson from '@/support/cli/print-json'

export default class ToolCommand extends BaseCommand<[string]> {
    public override readonly args = [
        {
            description: 'MCP tool name, such as konteks_warm_up',
            name: '<name>',
        },
    ]
    public readonly description = 'Show one MCP tool exposed by Konteks.'
    public readonly name = 'tool'

    public async handle({
        args,
    }: Required<BaseCommandInput<[string]>>): Promise<void> {
        const tool = mcpTools.find(item => item.name === args[0])

        if (!tool) {
            throw new Error(`Unknown Konteks tool: ${args[0]}`)
        }

        printJson(tool)
    }
}

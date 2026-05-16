import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import dryRunKonteksTool from '@/mcp/dry-run-konteks-tool'
import { callKonteksTool } from '@/mcp/handlers'
import mcpTools from '@/mcp/tools'
import { parseJsonInput } from '@/support/cli/print-json'
import printMcpCallResult from '@/support/cli/print-mcp-call-result'

type McpCallOptions = {
    apply?: boolean
    json?: boolean
}

export default class CallCommand extends BaseCommand<
    [string, string | undefined],
    McpCallOptions
> {
    override readonly args = [
        {
            description: 'MCP tool name, such as konteks_warm_up',
            name: '<tool>',
        },
        {
            description: 'Optional JSON tool input',
            name: '[json]',
        },
    ]
    readonly description = 'Preview or call one MCP tool for debugging.'
    readonly name = 'call'
    override readonly options = [
        {
            description: 'Actually execute mutating MCP tools.',
            flags: '--apply',
        },
        {
            description: 'Print the raw MCP result envelope as JSON.',
            flags: '--json',
        },
    ]

    async handle({
        args,
        globalOptions,
        options,
    }: BaseCommandInput<
        [string, string | undefined],
        McpCallOptions
    >): Promise<void> {
        const input = parseJsonInput(args[1])
        const tool = mcpTools.find(item => item.name === args[0])

        if (!tool) {
            throw new Error(`Unknown Konteks tool: ${args[0]}`)
        }

        const isReadOnly = tool.annotations?.readOnlyHint === true
        const result =
            isReadOnly || options.apply
                ? await callKonteksTool(
                      { project: globalOptions.project },
                      args[0],
                      input,
                  )
                : await dryRunKonteksTool(globalOptions, args[0], input)

        printMcpCallResult(result, {
            json: options.json,
        })
    }
}

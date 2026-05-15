import type { BaseCommandInput, Command } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import dryRunKonteksTool from '@/mcp/dry-run-konteks-tool'
import { callKonteksTool } from '@/mcp/handlers'
import { listKonteksTools } from '@/mcp/tools'
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
    constructor() {
        super({
            description: 'Preview or call one MCP tool for debugging.',
            name: 'call',
        })
    }

    protected override configure(command: Command): void {
        command
            .option('--apply', 'Actually execute mutating MCP tools.')
            .option('--json', 'Print the raw MCP result envelope as JSON.')
            .argument('<tool>', 'MCP tool name, such as konteks_warm_up')
            .argument('[json]', 'Optional JSON tool input')
    }

    override async handle({
        args,
        globalOptions,
        options,
    }: BaseCommandInput<
        [string, string | undefined],
        McpCallOptions
    >): Promise<void> {
        const input = parseJsonInput(args[1])
        const tool = listKonteksTools().find(item => item.name === args[0])

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

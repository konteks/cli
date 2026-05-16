import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types'
import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import mcpTools from '@/mcp/tools'
import type { GlobalCliOptions } from '@/models/cli'
import type { StartMcpServerOptions } from '@/models/mcp'
import { loadProjectContext, pathExists } from '@/providers/project/context'
import { parseJsonInput } from '@/support/cli/print-json'
import printMcpCallResult from '@/support/cli/print-mcp-call-result'
import { replaceStringDeep } from '@/support/object/value'

type McpCallOptions = {
    apply?: boolean
    json?: boolean
}

export default class CallCommand extends BaseCommand<
    [ToolName, string | undefined],
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
        [ToolName, string | undefined],
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
                ? await callMcpTool(
                      { project: globalOptions.project },
                      args[0],
                      input,
                  )
                : await dryRunCallTool(globalOptions, args[0], input)

        printMcpCallResult(result, {
            json: options.json,
        })
    }
}

type ToolName = (typeof mcpTools)[number]['name']

async function callMcpTool(
    options: StartMcpServerOptions,
    name: ToolName,
    input: unknown = {},
): Promise<CallToolResult> {
    const mcpTool = mcpTools.find(item => item.name === name)

    if (!mcpTool) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return await mcpTool.handle(options, input)
}

async function dryRunCallTool(
    options: GlobalCliOptions,
    name: ToolName,
    input: unknown,
): Promise<unknown> {
    const context = await loadProjectContext(options.project)
    const tempRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-dry-run-'))
    const tempMemoryDir = join(tempRoot, '.konteks')

    try {
        if (await pathExists(context.memoryDir)) {
            await cp(context.memoryDir, tempMemoryDir, { recursive: true })
        }

        const result = await callMcpTool(
            { memoryDir: tempMemoryDir, project: options.project },
            name,
            input,
        )
        return replaceStringDeep(result, tempMemoryDir, context.memoryDir)
    } finally {
        await rm(tempRoot, { force: true, recursive: true })
    }
}

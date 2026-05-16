import { cp, mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types'
import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import mcpTools from '@/mcp/tools'
import { loadProjectContext, pathExists } from '@/providers/project/context'
import { parseJsonInput } from '@/support/cli/print-json'
import printMcpCallResult from '@/support/cli/print-mcp-call-result'

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
                ? await callMcpTool(args[0], input)
                : await dryRunCallTool(args[0], input)

        printMcpCallResult(result, {
            json: options.json,
        })
    }
}

type ToolName = (typeof mcpTools)[number]['name']

async function callMcpTool(
    name: ToolName,
    input: unknown = {},
): Promise<CallToolResult> {
    const mcpTool = mcpTools.find(item => item.name === name)

    if (!mcpTool) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return await mcpTool.handle(input)
}

async function dryRunCallTool(
    name: ToolName,
    input: unknown,
): Promise<unknown> {
    const context = await loadProjectContext()
    const tempRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-dry-run-'))
    const tempMemoryDir = join(tempRoot, 'sandbox-memory')
    const backupMemoryDir = join(tempRoot, 'original-memory')
    const realMemoryExists = await pathExists(context.memoryDir)

    try {
        if (realMemoryExists) {
            await cp(context.memoryDir, tempMemoryDir, { recursive: true })
        } else {
            await mkdir(tempMemoryDir, { recursive: true })
        }

        if (realMemoryExists) {
            await rename(context.memoryDir, backupMemoryDir)
        }
        await cp(tempMemoryDir, context.memoryDir, { recursive: true })

        return await callMcpTool(name, input)
    } finally {
        await rm(context.memoryDir, { force: true, recursive: true })
        if (realMemoryExists) {
            await rename(backupMemoryDir, context.memoryDir)
        }
        await rm(tempRoot, { force: true, recursive: true })
    }
}

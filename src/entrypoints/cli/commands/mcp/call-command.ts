import { cp, mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import MCP_TOOLS from '@/entrypoints/mcp/tools'
import { loadProjectContext, pathExists } from '@/modules/project/context'
import consoleOutput from '@/support/console-output'
import { parseJsonInput, stringifyPretty } from '@/support/json/io'
import { isRecord } from '@/support/object/value'
import type { BaseCommandInput } from '../_base-command'
import BaseCommand from '../_base-command'

type McpToolName = (typeof MCP_TOOLS)[number]['name']

type McpCallOptions = {
    apply?: boolean
    json?: boolean
}

export default class CallCommand extends BaseCommand<
    [McpToolName, string | undefined],
    McpCallOptions
> {
    public override readonly args = [
        {
            description: 'MCP tool name, such as konteks_warm_up',
            name: '<tool>',
        },
        {
            description: 'Optional JSON tool input',
            name: '[json]',
        },
    ]
    public readonly description = 'Preview or call one MCP tool for debugging.'
    public readonly name = 'call'
    public override readonly options = [
        {
            description: 'Actually execute mutating MCP tools.',
            flags: '--apply',
        },
        {
            description: 'Print the raw MCP result envelope as JSON.',
            flags: '--json',
        },
    ]

    public async handle({
        args,
        options,
    }: Required<
        BaseCommandInput<[McpToolName, string | undefined], McpCallOptions>
    >): Promise<void> {
        const input = parseJsonInput(args[1])
        const tool = MCP_TOOLS.find(item => item.name === args[0])

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

async function callMcpTool(name: McpToolName, input: unknown = {}) {
    const mcpTool = MCP_TOOLS.find(item => item.name === name)

    if (!mcpTool) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return await mcpTool.handle(input)
}

async function dryRunCallTool(
    name: McpToolName,
    input: unknown,
): Promise<unknown> {
    const context = await loadProjectContext()
    const tempRoot = await mkdtemp(
        join(dirname(context.memoryDir), '.konteks-mcp-dry-run-'),
    )
    const tempMemoryDir = join(tempRoot, 'sandbox-memory')
    const backupMemoryDir = join(tempRoot, 'original-memory')
    const realMemoryExists = await pathExists(context.memoryDir)
    let backupMoved = false
    let sandboxInstalled = false
    let restored = false

    try {
        if (realMemoryExists) {
            await cp(context.memoryDir, tempMemoryDir, { recursive: true })
        } else {
            await mkdir(tempMemoryDir, { recursive: true })
        }

        if (realMemoryExists) {
            await rename(context.memoryDir, backupMemoryDir)
            backupMoved = true
        }
        await cp(tempMemoryDir, context.memoryDir, { recursive: true })
        sandboxInstalled = true

        return await callMcpTool(name, input)
    } finally {
        if (sandboxInstalled) {
            await rm(context.memoryDir, { force: true, recursive: true })
        }
        if (backupMoved) {
            await rename(backupMemoryDir, context.memoryDir)
            restored = true
        } else {
            restored = !realMemoryExists
        }
        if (restored) {
            await rm(tempRoot, { force: true, recursive: true })
        }
    }
}

function printMcpCallResult(
    result: unknown,
    options: { json?: boolean } = {},
): void {
    if (options.json) {
        consoleOutput.print(stringifyPretty(result))
        return
    }

    if (typeof result === 'string') {
        consoleOutput.print(result)
        return
    }

    const text = extractMcpText(result)
    if (text) {
        consoleOutput.print(text)
        return
    }

    consoleOutput.print(stringifyPretty(result))
}

function extractMcpText(result: unknown): string | undefined {
    if (!isRecord(result) || !Array.isArray(result.content)) {
        return undefined
    }

    const texts = result.content
        .map(item =>
            isRecord(item) &&
            item.type === 'text' &&
            typeof item.text === 'string'
                ? item.text
                : undefined,
        )
        .filter((text): text is string => Boolean(text))

    return texts.length > 0 ? texts.join('\n') : undefined
}

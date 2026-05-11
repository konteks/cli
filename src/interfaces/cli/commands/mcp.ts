import {
    callMcpTool,
    getMcpPrompt,
    listMcpPrompts,
    listMcpTools,
    startMcpServer,
} from '../../mcp/server'
import type { GlobalCliOptions } from '../options'
import { parseJsonInput, printJson } from './json-output'
import { printMcpCallResult } from './mcp-call-output'
import { dryRunMcpTool } from './mcp-dry-run'
import { parsePromptArguments } from './mcp-prompt-input'

export async function mcpCommand(options: GlobalCliOptions): Promise<void> {
    await startMcpServer({ project: options.project })
}

export async function mcpToolsCommand(): Promise<void> {
    printJson(listMcpTools())
}

export async function mcpPromptsCommand(): Promise<void> {
    printJson(listMcpPrompts())
}

export async function mcpPromptCommand(
    name: string,
    input?: string,
): Promise<void> {
    printJson(getMcpPrompt(name, parsePromptArguments(name, input)))
}

export async function mcpCallCommand(
    options: GlobalCliOptions,
    name: string,
    jsonInput?: string,
    callOptions: { apply?: boolean; json?: boolean } = {},
): Promise<void> {
    const input = parseJsonInput(jsonInput)
    const tool = listMcpTools().find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    const isReadOnly = tool.annotations?.readOnlyHint === true
    const result =
        isReadOnly || callOptions.apply
            ? await callMcpTool({ project: options.project }, name, input)
            : await dryRunMcpTool(options, name, input)

    printMcpCallResult(result, {
        json: callOptions.json,
    })
}

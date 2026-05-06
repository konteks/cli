import {
    callMcpTool,
    getMcpPrompt,
    listMcpPrompts,
    listMcpTools,
    startMcpServer,
} from '../../mcp/server.js'
import type { GlobalCliOptions } from '../options.js'

export async function mcpCommand(options: GlobalCliOptions): Promise<void> {
    await startMcpServer({ project: options.project })
}

export async function mcpToolsCommand(
    options: GlobalCliOptions,
): Promise<void> {
    printJson(listMcpTools({ project: options.project }))
}

export async function mcpPromptsCommand(): Promise<void> {
    printJson(listMcpPrompts())
}

export async function mcpPromptCommand(
    name: string,
    jsonInput?: string,
): Promise<void> {
    printJson(getMcpPrompt(name, parsePromptArguments(jsonInput)))
}

export async function mcpCallCommand(
    options: GlobalCliOptions,
    name: string,
    jsonInput?: string,
): Promise<void> {
    printJson(
        await callMcpTool(
            { project: options.project },
            name,
            parseJsonInput(jsonInput),
        ),
    )
}

function parsePromptArguments(jsonInput?: string): Record<string, string> {
    const parsed = parseJsonInput(jsonInput)
    if (!isRecord(parsed)) {
        throw new Error('Prompt arguments must be a JSON object.')
    }

    const args: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
        if (typeof value !== 'string') {
            throw new Error(`Prompt argument "${key}" must be a string.`)
        }
        args[key] = value
    }

    return args
}

function parseJsonInput(jsonInput?: string): unknown {
    if (!jsonInput) {
        return {}
    }

    try {
        return JSON.parse(jsonInput) as unknown
    } catch (error) {
        throw new Error(
            `Invalid JSON input: ${
                error instanceof Error ? error.message : String(error)
            }`,
        )
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function printJson(value: unknown): void {
    console.log(JSON.stringify(value, null, 2))
}

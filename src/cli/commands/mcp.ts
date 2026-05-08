import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    callMcpTool,
    getMcpPrompt,
    listMcpPrompts,
    listMcpTools,
    startMcpServer,
} from '../../mcp/server.js'
import { loadProjectContext, pathExists } from '../../project/context.js'
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
    const tool = listMcpTools({ project: options.project }).find(
        item => item.name === name,
    )

    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    const isReadOnly = tool.annotations?.readOnlyHint === true
    if (!isReadOnly && !callOptions.apply) {
        printMcpCallResult(await dryRunMcpTool(options, name, input), {
            json: callOptions.json,
        })
        return
    }

    printMcpCallResult(
        await callMcpTool({ project: options.project }, name, input),
        {
            json: callOptions.json,
        },
    )
}

async function dryRunMcpTool(
    options: GlobalCliOptions,
    name: string,
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

function replaceStringDeep(value: unknown, from: string, to: string): unknown {
    if (typeof value === 'string') {
        return value.split(from).join(to)
    }

    if (Array.isArray(value)) {
        return value.map(item => replaceStringDeep(item, from, to))
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                replaceStringDeep(item, from, to),
            ]),
        )
    }

    return value
}

function printMcpCallResult(
    result: unknown,
    options: { json?: boolean } = {},
): void {
    if (options.json) {
        printJson(result)
        return
    }

    const text = extractMcpText(result)
    if (text) {
        console.log(text)
        return
    }

    printJson(result)
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

function parsePromptArguments(
    name: string,
    input?: string,
): Record<string, string> {
    const trimmed = input?.trim()
    if (!trimmed) {
        return {}
    }

    if (name === 'konteks-warm-up' && !looksLikeJson(trimmed)) {
        return { prompt: trimmed }
    }

    const parsed = parseJsonInput(trimmed)
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

function looksLikeJson(value: string): boolean {
    return value.startsWith('{') || value.startsWith('[')
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

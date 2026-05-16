import { describe, expect, it } from 'bun:test'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js'
import { extractProject } from '@/providers/extraction/extract-project'
import {
    loadProjectContext,
    writeProjectConfig,
} from '@/providers/project/context'
import FakeEmbeddingProvider from '@/support/fake/fake-embedding-provider'
import FakeTreeSitterEngine from '@/support/fake/fake-tree-sitter-engine'
import { VERSION } from '@/support/version'

const execFileAsync = promisify(execFile)

describe('mcp/stdio interface', () => {
    it('exposes live server metadata and tool registrations over stdio', async () => {
        const fixture = await createInitializedProject('konteks-mcp-stdio-')

        try {
            const responses = await runMcpExchange(fixture.projectRoot, [
                request(2, 'tools/list'),
            ])
            const init = resultById<InitializeResult>(responses, 1)
            const tools = resultById<ToolsListResult>(responses, 2)

            expect(init.serverInfo).toEqual({
                name: 'konteks',
                version: VERSION,
            })
            expect(init.instructions).toContain('Warm Up -> Build -> Save flow')
            expect(init.capabilities).toMatchObject({
                prompts: {},
                tools: {},
            })

            expect(tools.tools.map(tool => tool.name)).toEqual([
                'konteks_warm_up',
                'konteks_recall',
                'konteks_save',
                'konteks_search',
                'konteks_forget',
            ])
            expect(
                tools.tools.map(tool => [
                    tool.name,
                    tool.annotations?.readOnlyHint,
                    tool.annotations?.destructiveHint,
                ]),
            ).toEqual([
                ['konteks_warm_up', false, false],
                ['konteks_recall', true, false],
                ['konteks_save', false, false],
                ['konteks_search', true, false],
                ['konteks_forget', false, true],
            ])

            const warmUpTool = tools.tools.find(
                tool => tool.name === 'konteks_warm_up',
            )
            expect(warmUpTool?.description).toContain(
                'stable project-wide briefing',
            )
            expect(warmUpTool?.inputSchema).toMatchObject({
                properties: {
                    maxTokens: { type: 'number' },
                    topic: { type: 'string' },
                },
                type: 'object',
            })

            const recallTool = tools.tools.find(
                tool => tool.name === 'konteks_recall',
            )
            expect(recallTool?.inputSchema).toMatchObject({
                properties: {
                    includeSources: { type: 'boolean' },
                    maxTokens: { type: 'number' },
                    task: { type: 'string' },
                },
                required: ['task'],
                type: 'object',
            })

            const saveTool = tools.tools.find(
                tool => tool.name === 'konteks_save',
            )
            expect(saveTool?.description).toContain('Persist structured')
            expect(saveTool?.inputSchema).toEqual({
                properties: {},
                type: 'object',
            })
        } finally {
            await fixture.cleanup()
        }
    }, 20000)

    it('exposes live prompt registrations and rendered prompt text over stdio', async () => {
        const fixture = await createInitializedProject('konteks-mcp-stdio-')

        try {
            const responses = await runMcpExchange(fixture.projectRoot, [
                request(2, 'prompts/list'),
                request(3, 'prompts/get', {
                    arguments: { topic: 'cli status command' },
                    name: 'konteks-warm-up',
                }),
            ])
            const prompts = resultById<PromptsListResult>(responses, 2)
            const prompt = resultById<PromptResult>(responses, 3)

            expect(prompts.prompts.map(item => item.name)).toEqual([
                'konteks-recall',
                'konteks-save',
                'konteks-warm-up',
            ])

            const warmUpPrompt = prompts.prompts.find(
                item => item.name === 'konteks-warm-up',
            )
            expect(warmUpPrompt).toMatchObject({
                arguments: [
                    {
                        name: 'topic',
                        required: false,
                    },
                ],
                description:
                    'Open a fresh Konteks session with project context.',
            })

            const promptText = extractPromptText(prompt.messages)
            expect(promptText).toContain('cli status command')
            expect(promptText).toContain('konteks_warm_up')
            expect(promptText).toContain(
                'Konteks is warmed up and ready for the task.',
            )
        } finally {
            await fixture.cleanup()
        }
    }, 20000)

    it('executes live stdio tool calls and rejects invalid input', async () => {
        const fixture = await createInitializedProject('konteks-mcp-stdio-')

        try {
            const successResponses = await runMcpExchange(fixture.projectRoot, [
                request(2, 'tools/call', {
                    arguments: { task: 'project entry point' },
                    name: 'konteks_recall',
                }),
                request(3, 'tools/call', {
                    arguments: { maxTokens: 500 },
                    name: 'konteks_warm_up',
                }),
                request(4, 'tools/call', {
                    arguments: {
                        summary:
                            'Saved a compact diary entry through the live MCP stdio interface test.',
                        type: 'diary',
                    },
                    name: 'konteks_save',
                }),
            ])

            expect(
                extractToolText(
                    resultById<ToolCallResult>(successResponses, 2),
                ),
            ).toContain('recall:')
            expect(
                extractToolText(
                    resultById<ToolCallResult>(successResponses, 3),
                ),
            ).toContain('warm_up:')
            expect(
                extractToolText(
                    resultById<ToolCallResult>(successResponses, 4),
                ),
            ).toContain('konteks: session saved')

            const invalidRecall = resultById<ToolCallResult>(
                await runMcpExchange(fixture.projectRoot, [
                    request(2, 'tools/call', {
                        arguments: {},
                        name: 'konteks_recall',
                    }),
                ]),
                2,
            )
            expect(invalidRecall.isError).toBe(true)
            expect(extractToolText(invalidRecall)).toContain(
                'Invalid arguments for tool konteks_recall',
            )

            const invalidSave = resultById<ToolCallResult>(
                await runMcpExchange(fixture.projectRoot, [
                    request(2, 'tools/call', {
                        arguments: { type: 'diary' },
                        name: 'konteks_save',
                    }),
                ]),
                2,
            )
            expect(invalidSave.isError).toBe(true)
            expect(extractToolText(invalidSave)).toContain(
                'Invalid arguments for tool konteks_save',
            )
        } finally {
            await fixture.cleanup()
        }
    }, 20000)
})

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

type JsonRpcResponse = {
    error?: { code: number; message: string }
    id: number
    jsonrpc: '2.0'
    result?: Json
}

type InitializeResult = {
    capabilities: Json
    instructions?: string
    protocolVersion: string
    serverInfo: { name: string; version: string }
}

type ToolCallResult = {
    content: Array<{ text?: string; type: string }>
    isError?: boolean
}

type ToolsListResult = {
    tools: Array<{
        annotations?: {
            destructiveHint?: boolean
            readOnlyHint?: boolean
        }
        description?: string
        inputSchema: Record<string, Json>
        name: string
    }>
}

type PromptsListResult = {
    prompts: Array<{
        arguments?: Array<{
            description?: string
            name: string
            required?: boolean
        }>
        description?: string
        name: string
    }>
}

type PromptResult = {
    messages: Json
}

async function createInitializedProject(prefix: string): Promise<{
    cleanup(): Promise<void>
    projectRoot: string
}> {
    const projectRoot = await mkdtemp(join(tmpdir(), prefix))

    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await writeFile(
        join(projectRoot, 'package.json'),
        JSON.stringify(
            {
                dependencies: { commander: '^14.0.0' },
                name: 'mcp-stdio-fixture',
                packageManager: 'bun@1.3.12',
            },
            null,
            2,
        ),
    )
    await writeFile(
        join(projectRoot, 'src', 'index.ts'),
        'export const run = () => "stdio fixture"\n',
    )
    await mkdir(join(projectRoot, '.konteks'), { recursive: true })

    const context = await loadProjectContext(projectRoot)
    await writeProjectConfig(context, context.config)
    await extractProject(context, 'full', {
        embeddingProvider: new FakeEmbeddingProvider(),
        treeSitterEngine: new FakeTreeSitterEngine() as never,
    })

    return {
        async cleanup() {
            await rm(projectRoot, { force: true, recursive: true })
        },
        projectRoot,
    }
}

async function runMcpExchange(
    projectRoot: string,
    requests: Array<{ id: number; method: string; params?: Json }>,
): Promise<JsonRpcResponse[]> {
    const exchangeRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-exchange-'))
    const inputPath = join(exchangeRoot, 'input.jsonl')
    const outputPath = join(exchangeRoot, 'output.jsonl')

    try {
        const input = [
            request(1, 'initialize', {
                capabilities: {},
                clientInfo: {
                    name: 'konteks-stdio-test',
                    version: '0.0.0',
                },
                protocolVersion: LATEST_PROTOCOL_VERSION,
            }),
            notification('notifications/initialized'),
            ...requests,
        ]
            .map(message => JSON.stringify(message))
            .join('\n')

        await writeFile(inputPath, `${input}\n`)
        const command = `node dist/main.js --project ${shellQuote(projectRoot)} mcp < ${shellQuote(inputPath)} > ${shellQuote(outputPath)}`

        await execFileAsync('sh', ['-lc', command], {
            cwd: process.cwd(),
            env: commandEnv(),
        })

        const raw = await Bun.file(outputPath).text()
        return raw
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => JSON.parse(line) as JsonRpcResponse)
    } finally {
        await rm(exchangeRoot, { force: true, recursive: true })
    }
}

function request(id: number, method: string, params?: Json) {
    return {
        id,
        jsonrpc: '2.0' as const,
        method,
        params,
    }
}

function notification(method: string, params?: Json) {
    return {
        jsonrpc: '2.0' as const,
        method,
        params,
    }
}

function resultById<T>(responses: JsonRpcResponse[], id: number): T {
    const response = responses.find(item => item.id === id)

    if (!response) {
        throw new Error(`Missing MCP response with id ${id}`)
    }
    if (response.error) {
        throw new Error(response.error.message)
    }

    return response.result as T
}

function extractPromptText(messages: Json): string {
    if (!Array.isArray(messages)) {
        throw new Error('Expected prompt messages to be an array')
    }

    const firstText = messages.find(
        (
            message,
        ): message is {
            content: { text: string; type: 'text' }
        } => {
            return (
                isRecord(message) &&
                isRecord(message.content) &&
                message.content.type === 'text' &&
                typeof message.content.text === 'string'
            )
        },
    )

    if (!firstText) {
        throw new Error('Expected a text prompt message')
    }

    return firstText.content.text
}

function extractToolText(result: ToolCallResult): string {
    const firstText = result.content.find(
        item => item.type === 'text' && typeof item.text === 'string',
    )

    if (!firstText?.text) {
        throw new Error('Expected a text tool result')
    }

    return firstText.text
}

function isRecord(value: Json): value is Record<string, Json> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function commandEnv(): Record<string, string> {
    return Object.fromEntries(
        Object.entries(process.env).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
    )
}

function shellQuote(value: string): string {
    return `'${value.replaceAll("'", "'\"'\"'")}'`
}

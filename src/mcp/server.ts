import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
    CallToolRequestSchema,
    type CallToolResult,
    ErrorCode,
    GetPromptRequestSchema,
    type GetPromptResult,
    ListPromptsRequestSchema,
    ListToolsRequestSchema,
    McpError,
    type Prompt,
    type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { listPromptDefinitions, renderPromptText } from './prompt-library.js'
import { recallGraph, recallHistory } from './recall-package.js'
import { registerKonteksTools } from './tool-handlers.js'
import { MCP_INSTRUCTIONS } from './tool-surface.js'
import type {
    FlexibleRegisterTool,
    StartMcpServerOptions,
    ToolRegistration,
} from './types.js'

export type { StartMcpServerOptions }
export { recallGraph, recallHistory }

export async function startMcpServer(
    options: StartMcpServerOptions,
): Promise<void> {
    const server = new Server(
        {
            name: 'konteks',
            version: '0.0.0',
        },
        {
            capabilities: {
                prompts: {},
                tools: {},
            },
            instructions: MCP_INSTRUCTIONS,
        },
    )
    const tools = createToolRegistrations(options)
    const prompts = listPromptDefinitions()

    server.setRequestHandler(ListPromptsRequestSchema, async () => ({
        prompts,
    }))

    server.setRequestHandler(GetPromptRequestSchema, async request => {
        const prompt = prompts.find(item => item.name === request.params.name)
        if (!prompt) {
            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown Konteks prompt: ${request.params.name}`,
            )
        }

        return getPromptResult(prompt, request.params.arguments ?? {})
    })

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: toolList(tools),
    }))

    server.setRequestHandler(CallToolRequestSchema, async request => {
        const tool = tools.get(request.params.name)

        if (!tool) {
            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown Konteks tool: ${request.params.name}`,
            )
        }

        try {
            return await tool.callback(request.params.arguments ?? {})
        } catch (error) {
            throw new McpError(
                ErrorCode.InvalidParams,
                error instanceof Error ? error.message : String(error),
            )
        }
    })

    await server.connect(new StdioServerTransport())
}

export function listMcpPrompts(): Prompt[] {
    return listPromptDefinitions()
}

export function getMcpPrompt(
    name: string,
    args: Record<string, string> = {},
): GetPromptResult {
    const prompt = listPromptDefinitions().find(item => item.name === name)
    if (!prompt) {
        throw new Error(`Unknown Konteks prompt: ${name}`)
    }

    return getPromptResult(prompt, args)
}

export function listMcpTools(options: StartMcpServerOptions): Tool[] {
    return toolList(createToolRegistrations(options))
}

export async function callMcpTool(
    options: StartMcpServerOptions,
    name: string,
    input: unknown = {},
): Promise<CallToolResult> {
    const tool = createToolRegistrations(options).get(name)
    if (!tool) {
        throw new Error(`Unknown Konteks tool: ${name}`)
    }

    return await tool.callback(input)
}

function createToolRegistrations(
    options: StartMcpServerOptions,
): Map<string, ToolRegistration> {
    const tools = new Map<string, ToolRegistration>()
    const registerTool: FlexibleRegisterTool = (name, config, callback) => {
        tools.set(name, {
            annotations: config.annotations,
            callback,
            description: config.description,
            inputSchema: config.inputSchema,
            name,
            outputSchema: config.outputSchema,
        })
    }

    registerKonteksTools(options, registerTool)
    return tools
}

function toolList(tools: Map<string, ToolRegistration>): Tool[] {
    return [...tools.values()].map(tool => ({
        annotations: tool.annotations,
        description: tool.description,
        inputSchema: tool.inputSchema,
        name: tool.name,
        outputSchema: tool.outputSchema,
    }))
}

function getPromptResult(
    prompt: Prompt,
    args: Record<string, string>,
): GetPromptResult {
    return {
        description: prompt.description,
        messages: [
            {
                content: {
                    text: renderPromptText(prompt.name, args),
                    type: 'text',
                },
                role: 'user',
            },
        ],
    }
}

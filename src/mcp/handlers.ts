import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import mcpTools from '@/mcp/tools/index'
import type { StartMcpServerOptions } from '@/models/mcp'

type ToolHandlers = Record<string, (input: unknown) => Promise<CallToolResult>>

export async function callKonteksTool(
    options: StartMcpServerOptions,
    name: string,
    input: unknown = {},
): Promise<CallToolResult> {
    const handlers = createToolHandlers(options)

    const handler = handlers[name]
    if (!handler) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return await handler(input)
}

function createToolHandlers(options: StartMcpServerOptions): ToolHandlers {
    return Object.fromEntries(
        mcpTools.map(tool => [
            tool.name,
            async (input: unknown) => await tool.handle(options, input),
        ]),
    )
}

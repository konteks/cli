import { describe, expect, it } from 'bun:test'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types'
import mcpTools from '@/mcp/tools'

describe('mcp/handlers', () => {
    it('rejects unknown tools before dispatch', async () => {
        await expect(callMcpTool('not-real', {})).rejects.toThrow(
            'Unknown tool: not-real',
        )
    })

    it('validates input before dispatch', async () => {
        await expect(callMcpTool('konteks_recall', {})).resolves.toMatchObject({
            isError: true,
        })
    })
})

async function callMcpTool(name: string, input: unknown) {
    const tool = mcpTools.find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return await registeredHandlerFor(tool)(input)
}

function registeredHandlerFor(inputTool: (typeof mcpTools)[number]) {
    let handler: ((input: unknown) => Promise<CallToolResult>) | undefined
    const server = {
        registerTool: (...args: unknown[]) => {
            handler = args[2] as (input: unknown) => Promise<CallToolResult>
        },
    } as McpServer

    inputTool.register(server)

    if (!handler) {
        throw new Error('Tool did not register a handler.')
    }

    return handler
}

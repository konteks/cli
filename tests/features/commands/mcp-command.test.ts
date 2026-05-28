import { afterEach, describe, expect, it, mock } from 'bun:test'

const toolRegistrations: Array<{ name: string }> = []
const promptRegistrations: Array<{ name: string }> = []
const serverConfigs: Array<{
    meta: { name: string; version: string }
    options: { instructions: string }
}> = []
const connectedTransports: unknown[] = []

class MockTransport {}

class MockServer {
    public constructor(
        meta: { name: string; version: string },
        options: { instructions: string },
    ) {
        serverConfigs.push({ meta, options })
    }

    public registerPrompt(
        name: string,
        _config: unknown,
        _handler: unknown,
    ): void {
        promptRegistrations.push({ name })
    }

    public registerTool(
        name: string,
        _config: unknown,
        _handler: unknown,
    ): void {
        toolRegistrations.push({ name })
    }

    public async connect(transport: unknown): Promise<void> {
        connectedTransports.push(transport)
    }
}

mock.module('@modelcontextprotocol/sdk/server/mcp.js', () => ({
    McpServer: MockServer,
}))

mock.module('@modelcontextprotocol/sdk/server/stdio.js', () => ({
    StdioServerTransport: MockTransport,
}))

describe('commands/mcp', () => {
    afterEach(() => {
        toolRegistrations.splice(0)
        promptRegistrations.splice(0)
        serverConfigs.splice(0)
        connectedTransports.splice(0)
    })

    it('registers tools and prompts before connecting the MCP server', async () => {
        const { default: McpCommand } = await import(
            '@/entrypoints/cli/commands/mcp'
        )
        const { default: mcpTools } = await import('@/entrypoints/mcp/tools')

        await new McpCommand().handle()

        expect(serverConfigs).toHaveLength(1)
        expect(serverConfigs[0]).toEqual({
            meta: {
                name: 'konteks',
                version: expect.any(String),
            },
            options: {
                instructions: expect.stringContaining(
                    'Warm Up -> Build -> Save flow',
                ),
            },
        })
        expect(toolRegistrations.map(item => item.name).sort()).toEqual(
            mcpTools.map(item => item.name).sort(),
        )
        expect(promptRegistrations.map(item => item.name).sort()).toEqual(
            ['konteks-recall', 'konteks-save', 'konteks-warm-up'].sort(),
        )
        expect(connectedTransports).toHaveLength(1)
        expect(connectedTransports[0]).toBeInstanceOf(MockTransport)
    })
})

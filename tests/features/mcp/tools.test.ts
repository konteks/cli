import { describe, expect, it } from 'bun:test'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types'
import z from 'zod'
import mcpTools from '@/mcp/tools'
import BaseMcpTool from '@/mcp/tools/_base-mcp-tool'

describe('MCP tools', () => {
    it('registers tools in API order with protocol annotations', () => {
        expect(mcpTools.map(tool => tool.name)).toEqual([
            'konteks_warm_up',
            'konteks_recall',
            'konteks_save_memories',
            'konteks_save_diary',
            'konteks_search',
            'konteks_forget',
        ])
        expect(
            mcpTools.map(tool => [
                tool.name,
                tool.annotations.readOnlyHint,
                tool.annotations.destructiveHint,
            ]),
        ).toEqual([
            ['konteks_warm_up', false, false],
            ['konteks_recall', true, false],
            ['konteks_save_memories', false, false],
            ['konteks_save_diary', false, false],
            ['konteks_search', true, false],
            ['konteks_forget', false, true],
        ])
        expect(mcpTools.every(tool => tool instanceof BaseMcpTool)).toBe(true)
    })

    it('validates input before executing a tool and formats object output', async () => {
        class FixtureTool extends BaseMcpTool {
            public readonly annotations = {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true,
            }
            public readonly description = 'Fixture tool.'
            public readonly inputSchema = z.object({
                value: z.string().min(1),
            })
            public readonly name = 'fixture_tool'

            public override async handle(
                input: z.output<typeof this.inputSchema>,
            ) {
                return input
            }
        }

        const tool = new FixtureTool()

        const callRegisteredTool = registeredHandlerFor(tool)

        await expect(callRegisteredTool({})).resolves.toEqual({
            content: [
                {
                    text: 'Invalid arguments for tool fixture_tool: value: Invalid input: expected string, received undefined',
                    type: 'text',
                },
            ],
            isError: true,
        })
        await expect(callRegisteredTool({ value: 'ok' })).resolves.toEqual({
            content: [{ text: 'value: ok', type: 'text' }],
        })
    })

    it('formats string output through the base handle flow', async () => {
        class FixtureTool extends BaseMcpTool {
            public readonly annotations = {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true,
            }
            public readonly description = 'Fixture tool.'
            public readonly inputSchema = z.object({
                value: z.string().min(1),
            })
            public readonly name = 'fixture_tool'

            public override async handle(
                input: z.output<typeof this.inputSchema>,
            ) {
                return `value=${input.value}`
            }
        }

        const tool = new FixtureTool()

        const callRegisteredTool = registeredHandlerFor(tool)

        await expect(callRegisteredTool({ value: 'ok' })).resolves.toEqual({
            content: [{ text: 'value=ok', type: 'text' }],
        })
    })

    it('sanitizes unexpected execution failures', async () => {
        class FixtureTool extends BaseMcpTool {
            public readonly annotations = {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true,
            }
            public readonly description = 'Fixture tool.'
            public readonly inputSchema = z.object({})
            public readonly name = 'fixture_tool'

            public override async handle(
                _input: z.output<typeof this.inputSchema>,
            ): Promise<string> {
                throw new Error('database exploded')
            }
        }

        const tool = new FixtureTool()
        const callRegisteredTool = registeredHandlerFor(tool)

        await expect(callRegisteredTool({})).resolves.toEqual({
            content: [
                {
                    text: 'Konteks MCP tool failed due to an internal error.',
                    type: 'text',
                },
            ],
            isError: true,
        })
    })
})

function registeredHandlerFor(
    tool: BaseMcpTool,
): (input: unknown) => Promise<CallToolResult> {
    let handler: ((input: unknown) => Promise<CallToolResult>) | undefined
    const server = {
        registerTool: (...args: unknown[]) => {
            handler = args[2] as (input: unknown) => Promise<CallToolResult>
        },
    } as McpServer

    tool.register(server)

    if (!handler) {
        throw new Error('Tool did not register a handler.')
    }

    return handler
}

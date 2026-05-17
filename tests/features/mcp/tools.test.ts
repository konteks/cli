import { describe, expect, it } from 'bun:test'
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

            protected override async coreHandle(
                input: z.output<typeof this.inputSchema>,
            ) {
                return input
            }
        }

        const tool = new FixtureTool()

        await expect(tool.handle({})).resolves.toEqual({
            content: [
                {
                    text: 'Invalid arguments for tool fixture_tool: value: Invalid input: expected string, received undefined',
                    type: 'text',
                },
            ],
            isError: true,
        })
        await expect(tool.handle({ value: 'ok' })).resolves.toEqual({
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

            protected override async coreHandle(
                input: z.output<typeof this.inputSchema>,
            ) {
                return `value=${input.value}`
            }
        }

        const tool = new FixtureTool()

        await expect(tool.handle({ value: 'ok' })).resolves.toEqual({
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

            protected override async coreHandle(): Promise<string> {
                throw new Error('database exploded')
            }
        }

        const tool = new FixtureTool()

        await expect(tool.handle({})).resolves.toEqual({
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

import { describe, expect, it } from 'bun:test'
import z from 'zod'
import type { StartMcpServerOptions } from '@/models/mcp'
import BaseMcpTool from './_base-mcp-tool'

describe('BaseMcpTool', () => {
    it('validates input before executing the tool', async () => {
        class FixtureTool extends BaseMcpTool<{ value: string }> {
            annotations = {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true,
            }
            description = 'Fixture tool.'
            inputSchema = z.object({ value: z.string().min(1) })
            name = 'konteks_search' as const

            protected override async execute(
                _options: StartMcpServerOptions,
                input: { value: string },
            ) {
                return this.formatOutput(input)
            }
        }

        const tool = new FixtureTool()

        await expect(tool.handle({}, {})).rejects.toThrow()
        await expect(tool.handle({}, { value: 'ok' })).resolves.toEqual({
            content: [{ text: 'value: ok', type: 'text' }],
        })
    })
})

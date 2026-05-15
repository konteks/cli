import { describe, expect, it } from 'bun:test'
import type { StartMcpServerOptions } from '@/models/mcp'
import type { ForgetResult } from '@/models/memory'
import ForgetMcpTool from './forget-mcp-tool'

describe('ForgetMcpTool', () => {
    it('declares MCP metadata', () => {
        const tool = new ForgetMcpTool()

        expect(tool.name).toBe('konteks_forget')
        expect(tool.annotations.readOnlyHint).toBe(false)
        expect(tool.annotations.destructiveHint).toBe(true)
    })

    it('validates input and formats forget output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new ForgetMcpTool(
            async (options): Promise<ForgetResult> => {
                receivedOptions = options
                return {
                    accepted: true,
                    affectedIds: ['memory-1'],
                    mode: 'soft_delete',
                }
            },
        )

        await expect(tool.handle({}, {})).rejects.toThrow()
        const result = await tool.handle(
            { project: '/repo' },
            { id: 'memory-1' },
        )

        expect(receivedOptions).toEqual({ project: '/repo' })
        const output = result.content[0]
        if (output?.type !== 'text') {
            throw new Error('Expected text MCP output')
        }
        expect(output.text).toContain('accepted: true')
        expect(output.text).toContain('memory-1')
    })
})

import { describe, expect, it } from 'bun:test'
import mcpTools from '@/mcp/tools'
import type { StartMcpServerOptions } from '@/models/mcp'

describe('mcp/handlers', () => {
    it('rejects unknown tools before dispatch', async () => {
        await expect(
            callMcpTool({ project: '/tmp/project' }, 'not-real', {}),
        ).rejects.toThrow('Unknown tool: not-real')
    })

    it('validates input before dispatch', async () => {
        await expect(
            callMcpTool({ project: '/tmp/project' }, 'konteks_recall', {}),
        ).rejects.toThrow()
    })
})

async function callMcpTool(
    options: StartMcpServerOptions,
    name: string,
    input: unknown,
) {
    const tool = mcpTools.find(item => item.name === name)

    if (!tool) {
        throw new Error(`Unknown tool: ${name}`)
    }

    return await tool.handle(options, input)
}

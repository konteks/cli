import { describe, expect, it } from 'bun:test'
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

    return await tool.handle(input)
}

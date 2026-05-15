import { describe, expect, it } from 'bun:test'
import type { WarmUpResult } from '@/memory/warm-up-memory'
import type { StartMcpServerOptions } from '@/models/mcp'
import WarmUpMcpTool from './warm-up-mcp-tool'

describe('WarmUpMcpTool', () => {
    it('declares MCP metadata', () => {
        const tool = new WarmUpMcpTool()

        expect(tool.name).toBe('konteks_warm_up')
        expect(tool.annotations.readOnlyHint).toBe(false)
        expect(tool.annotations.destructiveHint).toBe(false)
    })

    it('passes server options and formats warm-up output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new WarmUpMcpTool(async (options, input) => {
            receivedOptions = options
            expect(input.topic).toBe('routing')
            return warmUpResult()
        })

        const result = await tool.handle(
            { project: '/repo' },
            { topic: 'routing' },
        )

        expect(receivedOptions).toEqual({ project: '/repo' })
        const output = result.content[0]
        if (output?.type !== 'text') {
            throw new Error('Expected text MCP output')
        }
        expect(output.text).toContain('warm_up:')
        expect(output.text).toContain('Test summary')
    })
})

function warmUpResult(): WarmUpResult {
    return {
        warmUp: {
            architecture: [],
            entryPoints: [],
            guidance: [],
            highlights: [],
            keyFiles: [],
            summary: 'Test summary',
            taxonomy: [],
            technologies: ['TypeScript'],
        },
    }
}

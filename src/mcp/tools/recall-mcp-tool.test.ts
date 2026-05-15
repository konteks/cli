import { describe, expect, it } from 'bun:test'
import type { StartMcpServerOptions } from '@/models/mcp'
import type { RecallPackage } from '@/models/memory'
import RecallMcpTool from './recall-mcp-tool'

describe('RecallMcpTool', () => {
    it('declares MCP metadata', () => {
        const tool = new RecallMcpTool()

        expect(tool.name).toBe('konteks_recall')
        expect(tool.annotations.readOnlyHint).toBe(true)
        expect(tool.annotations.destructiveHint).toBe(false)
    })

    it('validates input and formats recall output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new RecallMcpTool(async (options, input) => {
            receivedOptions = options
            expect(input.task).toBe('task')
            return recallPackage()
        })

        await expect(tool.handle({}, {})).rejects.toThrow()
        const result = await tool.handle({ project: '/repo' }, { task: 'task' })

        expect(receivedOptions).toEqual({ project: '/repo' })
        const output = result.content[0]
        if (output?.type !== 'text') {
            throw new Error('Expected text MCP output')
        }
        expect(output.text).toContain('recall:')
        expect(output.text).toContain('task: task')
    })
})

function recallPackage(): RecallPackage {
    return {
        brief: ['Use command classes.'],
        graph: [],
        history: [],
        memories: [],
        primaryTargets: [],
        quality: 'partial',
        sourceCount: 0,
        task: 'task',
        tokenBudget: 2000,
    }
}

import { describe, expect, it } from 'bun:test'
import type { StartMcpServerOptions } from '@/models/mcp'
import type { MemorySearchResult } from '@/models/memory'
import SearchMcpTool from './search-mcp-tool'

describe('SearchMcpTool', () => {
    it('declares MCP metadata', () => {
        const tool = new SearchMcpTool()

        expect(tool.name).toBe('konteks_search')
        expect(tool.annotations.readOnlyHint).toBe(true)
        expect(tool.annotations.destructiveHint).toBe(false)
    })

    it('validates input and formats search output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new SearchMcpTool(async options => {
            receivedOptions = options
            return [memoryResult()]
        })

        await expect(tool.handle({}, {})).rejects.toThrow()
        const result = await tool.handle(
            { project: '/repo' },
            { query: 'command' },
        )

        expect(receivedOptions).toEqual({ project: '/repo' })
        const output = result.content[0]
        if (output?.type !== 'text') {
            throw new Error('Expected text MCP output')
        }
        expect(output.text).toContain('search:')
        expect(output.text).toContain('query: command')
    })
})

function memoryResult(): MemorySearchResult {
    return {
        createdAt: '2026-05-16T00:00:00.000Z',
        excerpt: 'Command class architecture',
        id: 'memory-1',
        score: 100,
        type: 'memory',
    }
}

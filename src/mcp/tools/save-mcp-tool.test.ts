import { describe, expect, it } from 'bun:test'
import type { StartMcpServerOptions } from '@/models/mcp'
import type { SaveResult } from '@/models/memory'
import SaveMcpTool from './save-mcp-tool'

describe('SaveMcpTool', () => {
    it('declares MCP metadata', () => {
        const tool = new SaveMcpTool()

        expect(tool.name).toBe('konteks_save')
        expect(tool.annotations.readOnlyHint).toBe(false)
        expect(tool.annotations.destructiveHint).toBe(false)
    })

    it('validates input and formats save output', async () => {
        let receivedOptions: StartMcpServerOptions | undefined
        const tool = new SaveMcpTool(async (options): Promise<SaveResult> => {
            receivedOptions = options
            return {
                accepted: true,
                diaryId: 'diary-1',
                id: 'diary-1',
            }
        })

        await expect(tool.handle({}, { type: 'diary' })).rejects.toThrow()
        const result = await tool.handle(
            { project: '/repo' },
            {
                summary: 'This diary entry has enough words to save safely.',
                type: 'diary',
            },
        )

        expect(receivedOptions).toEqual({ project: '/repo' })
        const output = result.content[0]
        if (output?.type !== 'text') {
            throw new Error('Expected text MCP output')
        }
        expect(output.text).toBe('konteks: session saved, 1 diary entry.')
    })
})

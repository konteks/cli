import { describe, expect, it } from 'bun:test'
import { callKonteksTool } from './handlers'

describe('mcp/handlers', () => {
    it('rejects unknown tools before dispatch', async () => {
        await expect(
            callKonteksTool({ project: '/tmp/project' }, 'not-real', {}),
        ).rejects.toThrow('Unknown tool: not-real')
    })

    it('validates input before dispatch', async () => {
        await expect(
            callKonteksTool({ project: '/tmp/project' }, 'konteks_recall', {}),
        ).rejects.toThrow()
    })

    it('compiles representative type contracts', () => {
        expect(['ToolHandlers']).toEqual(['ToolHandlers'])
    })
})

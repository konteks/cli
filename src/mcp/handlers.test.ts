import { describe, expect, it } from 'bun:test'
import type { ToolHandlers } from './handlers'
import { callKonteksTool, createToolHandlers } from './handlers'

type CoveredTypes = [ToolHandlers]

describe('mcp/handlers', () => {
    it('creates handlers for all MCP tools', () => {
        expect(
            Object.keys(createToolHandlers({ project: '/tmp/project' })),
        ).toEqual([
            'konteks_forget',
            'konteks_recall',
            'konteks_save',
            'konteks_search',
            'konteks_warm_up',
        ])
    })

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
        type _Covered = CoveredTypes
        expect(['ToolHandlers']).toEqual(['ToolHandlers'])
    })
})

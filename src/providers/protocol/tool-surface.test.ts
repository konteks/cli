import { describe, expect, it } from 'bun:test'
import { KONTEKS_TOOL_SURFACE, MCP_INSTRUCTIONS } from './tool-surface'

describe('providers/protocol/tool-surface', () => {
    it('documents the warm up, recall, save, search, and forget tools', () => {
        expect(KONTEKS_TOOL_SURFACE.map(tool => tool.name)).toEqual([
            'konteks_warm_up',
            'konteks_recall',
            'konteks_save',
            'konteks_search',
            'konteks_forget',
        ])
        expect(
            KONTEKS_TOOL_SURFACE.map(tool => [
                tool.name,
                tool.annotations?.readOnlyHint,
                tool.annotations?.destructiveHint,
            ]),
        ).toEqual([
            ['konteks_warm_up', false, false],
            ['konteks_recall', true, false],
            ['konteks_save', false, false],
            ['konteks_search', true, false],
            ['konteks_forget', false, true],
        ])
    })

    it('describes the expected prompt workflow', () => {
        expect(MCP_INSTRUCTIONS).toContain('Warm Up -> Build -> Save')
        expect(MCP_INSTRUCTIONS).toContain('konteks_warm_up')
        expect(MCP_INSTRUCTIONS).toContain('konteks_save')
    })
})

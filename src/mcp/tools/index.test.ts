import { describe, expect, it } from 'bun:test'
import mcpTools from '.'
import BaseMcpTool from './_base-mcp-tool'

describe('mcp/tools', () => {
    it('registers MCP tools in API order', () => {
        expect(mcpTools.map(tool => tool.name)).toEqual([
            'konteks_warm_up',
            'konteks_recall',
            'konteks_save',
            'konteks_search',
            'konteks_forget',
        ])
        expect(
            mcpTools.map(tool => [
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

    it('contains class-based tool instances only', () => {
        expect(mcpTools.every(tool => tool instanceof BaseMcpTool)).toBe(true)
    })
})

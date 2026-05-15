import { describe, expect, it } from 'bun:test'
import callMcpToolCommand from './call-mcp-tool-command'

describe('controllers/call-mcp-tool', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['callMcpToolCommand', callMcpToolCommand, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['callMcpToolCommand'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

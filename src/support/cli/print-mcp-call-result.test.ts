import { describe, expect, it } from 'bun:test'
import printMcpCallResult from './print-mcp-call-result'

describe('support/cli/mcp-call-output', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['printMcpCallResult', printMcpCallResult, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['printMcpCallResult'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

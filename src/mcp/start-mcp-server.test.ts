import { describe, expect, it } from 'bun:test'
import startMcpServer from './start-mcp-server'

describe('start mcp server', () => {
    it('define startMcpServer', () => {
        expect(startMcpServer).toBeDefined()
    })
})

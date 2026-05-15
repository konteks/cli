import { describe, expect, it } from 'bun:test'
import McpCommand from './mcp-command'

describe('McpCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new McpCommand([])

        expect(command.name).toBe('mcp')
        expect(command.printsHeader).toBe(false)
        expect(command.requiresProject).toBe(true)
    })
})

import { describe, expect, it } from 'bun:test'
import ToolsCommand from './tools-command'

describe('ToolsCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new ToolsCommand()

        expect(command.name).toBe('tools')
        expect(command.printsHeader).toBe(false)
        expect(command.requiresProject).toBe(true)
    })
})

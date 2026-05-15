import { describe, expect, it } from 'bun:test'
import ToolCommand from './tool-command'

describe('ToolCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new ToolCommand()

        expect(command.name).toBe('tool')
        expect(command.printsHeader).toBe(false)
        expect(command.requiresProject).toBe(true)
    })
})

import { describe, expect, it } from 'bun:test'
import PromptsCommand from './prompts-command'

describe('PromptsCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new PromptsCommand()

        expect(command.name).toBe('prompts')
        expect(command.printsHeader).toBe(false)
        expect(command.requiresProject).toBe(true)
    })
})

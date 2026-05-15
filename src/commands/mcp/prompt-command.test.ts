import { describe, expect, it } from 'bun:test'
import PromptCommand from './prompt-command'

describe('PromptCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new PromptCommand()

        expect(command.name).toBe('prompt')
        expect(command.printsHeader).toBe(false)
        expect(command.requiresProject).toBe(true)
    })
})

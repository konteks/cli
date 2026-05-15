import { describe, expect, it } from 'bun:test'
import RestoreCommand from './restore-command'

describe('RestoreCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new RestoreCommand()

        expect(command.name).toBe('restore')
        expect(command.printsHeader).toBe(true)
        expect(command.requiresProject).toBe(false)
    })
})

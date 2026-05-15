import { describe, expect, it } from 'bun:test'
import StatusCommand from './status-command'

describe('StatusCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new StatusCommand()

        expect(command.name).toBe('status')
        expect(command.printsHeader).toBe(true)
        expect(command.requiresProject).toBe(true)
    })
})

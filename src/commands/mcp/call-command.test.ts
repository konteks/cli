import { describe, expect, it } from 'bun:test'
import CallCommand from './call-command'

describe('CallCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new CallCommand()

        expect(command.name).toBe('call')
        expect(command.printsHeader).toBe(false)
        expect(command.requiresProject).toBe(true)
    })
})

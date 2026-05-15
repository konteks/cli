import { describe, expect, it } from 'bun:test'
import ConfigCommand from './config-command'

describe('ConfigCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new ConfigCommand()

        expect(command.name).toBe('config')
        expect(command.printsHeader).toBe(true)
        expect(command.requiresProject).toBe(true)
    })
})

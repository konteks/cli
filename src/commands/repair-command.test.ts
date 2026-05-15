import { describe, expect, it } from 'bun:test'
import RepairCommand from './repair-command'

describe('RepairCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new RepairCommand()

        expect(command.name).toBe('repair')
        expect(command.printsHeader).toBe(true)
        expect(command.requiresProject).toBe(true)
    })
})

import { describe, expect, it } from 'bun:test'
import ImportCommand from './import-command'

describe('ImportCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new ImportCommand()

        expect(command.name).toBe('import')
        expect(command.printsHeader).toBe(true)
        expect(command.requiresProject).toBe(true)
    })
})

import { describe, expect, it } from 'bun:test'
import ExportCommand from './export-command'

describe('ExportCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new ExportCommand()

        expect(command.name).toBe('export')
        expect(command.printsHeader).toBe(true)
        expect(command.requiresProject).toBe(true)
    })
})

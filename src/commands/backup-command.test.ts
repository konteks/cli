import { describe, expect, it } from 'bun:test'
import BackupCommand from './backup-command'

describe('BackupCommand', () => {
    it('declares the public CLI metadata', () => {
        const command = new BackupCommand()

        expect(command.name).toBe('backup')
        expect(command.printsHeader).toBe(true)
        expect(command.requiresProject).toBe(true)
    })
})

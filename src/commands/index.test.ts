import { describe, expect, it } from 'bun:test'
import { commands, memoryCommands } from './index'

describe('commands', () => {
    it('exports the top-level command registry', () => {
        expect(commands.map(command => command.name)).toEqual([
            'init',
            'config',
            'status',
            'repair',
            'backup',
            'restore',
            'install-skills',
            'mcp',
        ])
    })

    it('exports the memory command registry', () => {
        expect(memoryCommands.map(command => command.name)).toEqual([
            'export',
            'import',
        ])
    })
})

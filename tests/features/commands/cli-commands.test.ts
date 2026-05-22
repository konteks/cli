import { describe, expect, it } from 'bun:test'
import { Command } from 'commander'
import type { BaseCommandContext } from '@/entrypoints/cli/commands/_base-command'
import { COMMANDS, MEMORY_COMMANDS } from '@/entrypoints/cli/commands/index'

describe('CLI command registry', () => {
    it('registers top-level and memory command groups in public CLI order', () => {
        expect(COMMANDS.map(command => command.name)).toEqual([
            'init',
            'config',
            'status',
            'repair',
            'backup',
            'restore',
            'install-skills',
            'mcp',
        ])
        expect(MEMORY_COMMANDS.map(command => command.name)).toEqual([
            'export',
            'import',
        ])
    })

    it('wires command registrars into Commander without duplicate names', () => {
        const program = new Command()
        const context: BaseCommandContext = {
            runInitializationGuard: async () => {},
        }

        for (const command of COMMANDS) {
            command.register(program, context)
        }
        const memory = program.command('memory')
        for (const command of MEMORY_COMMANDS) {
            command.register(memory, context)
        }

        expect(program.commands.map(command => command.name())).toEqual([
            'init',
            'config',
            'status',
            'repair',
            'backup',
            'restore',
            'install-skills',
            'mcp',
            'memory',
        ])
        expect(
            program.commands
                .find(command => command.name() === 'mcp')
                ?.commands.map(command => command.name()),
        ).toEqual(['tools', 'tool', 'call'])
        expect(
            program.commands
                .find(command => command.name() === 'memory')
                ?.commands.map(command => command.name()),
        ).toEqual(['export', 'import'])
    })
})

import { describe, expect, it } from 'bun:test'
import { Command } from 'commander'
import type { BaseCommandContext } from '@/commands/_base-command'
import { commands, memoryCommands } from '@/commands/index'

describe('CLI command registry', () => {
    it('registers top-level and memory command groups in public CLI order', () => {
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
        expect(memoryCommands.map(command => command.name)).toEqual([
            'export',
            'import',
        ])
    })

    it('wires command registrars into Commander without duplicate names', () => {
        const program = new Command()
        const context: BaseCommandContext = {
            ensureInitialized: async () => {},
            getGlobalOptions: () => ({}),
        }

        for (const command of commands) {
            command.register(program, context)
        }
        const memory = program.command('memory')
        for (const command of memoryCommands) {
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
        ).toEqual(['tools', 'tool', 'prompts', 'prompt', 'call'])
        expect(
            program.commands
                .find(command => command.name() === 'memory')
                ?.commands.map(command => command.name()),
        ).toEqual(['export', 'import'])
    })
})

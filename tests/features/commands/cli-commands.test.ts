import { describe, expect, it } from 'bun:test'
import { COMMANDS, MEMORY_COMMANDS } from '@/entrypoints/cli/commands/index'

describe('CLI command registry', () => {
    it('registers top-level and memory command groups in public CLI order', () => {
        expect(COMMANDS.map(command => command.name)).toEqual([
            'init',
            'config',
            'status',
            'rebuild',
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
})

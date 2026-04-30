#!/usr/bin/env node
import { Command } from 'commander'
import { doctorCommand } from './cli/commands/doctor.js'
import { grammarCommand } from './cli/commands/grammar.js'
import { initCommand } from './cli/commands/init.js'
import { mcpCommand } from './cli/commands/mcp.js'
import { mineCommand } from './cli/commands/mine.js'
import { statusCommand } from './cli/commands/status.js'

const VERSION = '0.0.0'

const program = new Command()
    .name('konteks')
    .description('Project-local context memory for AI coding agents.')
    .version(VERSION)
    .option('--project <path>', 'Project root override')

program
    .command('init')
    .description('Create .konteks/ and default config for this project.')
    .action(async () => {
        await initCommand(program.opts())
    })

program
    .command('status')
    .description('Print Konteks project memory status for humans.')
    .action(async () => {
        await statusCommand(program.opts())
    })

program
    .command('doctor')
    .description('Diagnose runtime, project root, and memory directory setup.')
    .action(async () => {
        await doctorCommand(program.opts())
    })

program
    .command('mine')
    .description('Scan the project and populate Konteks memory.')
    .option(
        '--changed',
        'Only mine files changed since the last successful mine',
    )
    .action(async options => {
        await mineCommand(program.opts(), options)
    })

program
    .command('mcp')
    .description('Start the Konteks MCP server over stdio.')
    .action(async () => {
        await mcpCommand(program.opts())
    })

const grammar = program
    .command('grammar')
    .description('Manage Konteks grammar assets.')

grammar
    .command('list')
    .description('List built-in grammars and installation status.')
    .action(async () => {
        await grammarCommand('list')
    })

grammar
    .command('add')
    .description('Install a bundled grammar into global cache.')
    .argument('<language>', 'Language (javascript, typescript, tsx)')
    .action(async language => {
        await grammarCommand('add', language)
    })

grammar
    .command('remove')
    .description('Remove an installed grammar from global cache.')
    .argument('<language>', 'Language (javascript, typescript, tsx)')
    .action(async language => {
        await grammarCommand('remove', language)
    })

await program.parseAsync(process.argv)

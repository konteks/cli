#!/usr/bin/env node
import { Command } from 'commander'
import { doctorCommand } from './cli/commands/doctor.js'
import { initCommand } from './cli/commands/init.js'
import { mcpCommand } from './cli/commands/mcp.js'
import { repairCommand } from './cli/commands/mine.js'
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
    .command('repair')
    .description('Repair Konteks memory by rebuilding artifacts from scratch.')
    .action(async () => {
        await repairCommand(program.opts())
    })

program
    .command('mcp')
    .description('Start the Konteks MCP server over stdio.')
    .action(async () => {
        await mcpCommand(program.opts())
    })

await program.parseAsync(process.argv)

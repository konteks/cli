#!/usr/bin/env node
import { Command } from 'commander'
import { commands, memoryCommands } from '@/commands'
import type { BaseCommandContext } from '@/commands/_base-command'
import ensureCliProjectInitialized from '@/middlewares/ensure-cli-project-initialized'
import printCliError from '@/support/cli/print-cli-error'
import { VERSION } from '@/support/version'

export function createCliProgram(): Command {
    const program = new Command()
        .name('konteks')
        .description(
            `Konteks ${VERSION} - Project-local context memory for AI coding agents.`,
        )
        .version(VERSION)

    registerCommands(program, {
        runInitializationGuard: ensureCliProjectInitialized,
    })

    return program
}

function registerCommands(program: Command, context: BaseCommandContext): void {
    commands.forEach(command => {
        command.register(program, context)
    })

    const memory = program
        .command('memory')
        .description('Import or export portable durable memory.')

    memoryCommands.forEach(command => {
        command.register(memory, context)
    })
}

createCliProgram()
    .parseAsync(process.argv)
    .catch(error => {
        printCliError(error)
        process.exitCode = 1
    })

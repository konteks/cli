#!/usr/bin/env node
import { Command } from 'commander'
import { commands, memoryCommands } from '@/commands'
import type { BaseCommandContext } from '@/commands/_base-command'
import ensureCliProjectInitialized from '@/middlewares/ensure-cli-project-initialized'
import printCliError from '@/support/cli/print-cli-error'
import { VERSION } from '@/support/version'

export type CreateCliProgramOptions = {
    ensureInitialized?: (project?: string) => Promise<void>
}

export function createCliProgram(
    options: CreateCliProgramOptions = {},
): Command {
    const ensureInitialized =
        options.ensureInitialized ?? ensureCliProjectInitialized

    const program = new Command()
        .name('konteks')
        .description(
            `Konteks ${VERSION} - Project-local context memory for AI coding agents.`,
        )
        .version(VERSION)
        .option('--project <path>', 'Project root override')

    registerCommands(program, {
        ensureInitialized,
        getGlobalOptions: () => program.opts(),
    })

    return program
}

function registerCommands(program: Command, context: BaseCommandContext): void {
    for (const command of commands) {
        command.register(program, context)
    }

    const memory = program
        .command('memory')
        .description('Import or export portable durable memory.')
    for (const command of memoryCommands) {
        command.register(memory, context)
    }
}

createCliProgram()
    .parseAsync(process.argv)
    .catch(error => {
        printCliError(error)
        process.exitCode = 1
    })

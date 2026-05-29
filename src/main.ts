#!/usr/bin/env node
import { Command } from 'commander'
import { projectMemoryDatabasePath } from '@/database/services/project-memory'
import { COMMANDS, MEMORY_COMMANDS } from '@/entrypoints/cli/commands'
import type { BaseCommandContext } from '@/entrypoints/cli/commands/_base-command'
import { readExtractionManifest } from '@/modules/extraction/engine/manifest'
import { loadProjectContext, pathExists } from '@/modules/project/context'
import CliUserError from '@/support/cli/cli-user-error'
import { configureCliHelp } from '@/support/configure-cli-help'
import consoleOutput, {
    type ConsoleColorPalette,
} from '@/support/console-output'
import { appendProjectErrorLog } from '@/support/error-log'
import getVersion from '@/support/get-version'

export async function createCliProgram(): Promise<Command> {
    const VERSION = getVersion()

    const program = new Command()
        .name('konteks')
        .description(
            `Konteks ${VERSION} - Project-local context memory for AI coding agents.`,
        )
        .version(VERSION)

    await configureCliHelp(program)

    registerCommands(program, {
        runInitializationGuard: ensureCliProjectInitialized,
    })

    return program
}

function registerCommands(program: Command, context: BaseCommandContext): void {
    COMMANDS.forEach(command => {
        command.register(program, context)
    })

    const memory = program
        .command('memory')
        .description('Import or export portable durable memory.')

    MEMORY_COMMANDS.forEach(command => {
        command.register(memory, context)
    })
}

const mainCommand = await createCliProgram()

mainCommand.parseAsync(process.argv).catch(async error => {
    const logged =
        error instanceof CliUserError
            ? false
            : await appendProjectErrorLog({
                  error,
                  metadata: { argv: process.argv.slice(2) },
                  surface: 'cli',
              }).then(result => result.written)
    printCliError(error, logged)
    process.exitCode = 1
})

const uninitializedCliMessage = 'Project memory is missing or incomplete.'

async function ensureCliProjectInitialized(): Promise<void> {
    const context = await loadProjectContext()

    if (!context.configExists) {
        throw createUninitializedCliError()
    }

    if (!(await readExtractionManifest(context.memoryDir))) {
        throw createUninitializedCliError()
    }

    if (!(await pathExists(projectMemoryDatabasePath(context)))) {
        throw createUninitializedCliError()
    }
}

function createUninitializedCliError(): CliUserError {
    return new CliUserError({
        command: 'konteks init',
        hint: 'Initialize this project, then retry your command.',
        message: uninitializedCliMessage,
        title: 'Konteks memory is not initialized',
    })
}

function printCliError(error: unknown, logged = false): void {
    consoleOutput.writeError(color => {
        const output =
            error instanceof CliUserError
                ? formatUserError(error, color)
                : formatUnexpectedError(error, color, logged)

        return `${output}\n`
    })
}

function formatUserError(
    error: CliUserError,
    color: ConsoleColorPalette,
): string {
    const lines = [
        `${color.error('╭─')} ${color.error(error.title)}`,
        `${color.error('│')}`,
        `${color.error('│')}  ${error.message}`,
    ]

    if (error.command) {
        lines.push(
            `${color.error('│')}`,
            `${color.error('│')}  ${color.dim('Run')}`,
            `${color.error('│')}    ${color.primary(error.command)}`,
        )
    }

    if (error.hint) {
        lines.push(
            `${color.error('│')}`,
            `${color.error('│')}  ${color.warning(error.hint)}`,
        )
    }

    lines.push(`${color.error('╰─')}`)

    return lines.join('\n')
}

function formatUnexpectedError(
    error: unknown,
    color: ConsoleColorPalette,
    logged: boolean,
): string {
    const message = error instanceof Error ? error.message : String(error)
    const lines = [
        `${color.error('╭─')} ${color.error('Konteks command failed')}`,
        `${color.error('│')}`,
        `${color.error('│')}  ${message || 'Unknown error'}`,
    ]

    if (error instanceof Error && process.env.KONTEKS_DEBUG && error.stack) {
        lines.push(
            `${color.error('│')}`,
            ...error.stack
                .split('\n')
                .slice(1)
                .map(line => `${color.error('│')}  ${color.dim(line.trim())}`),
        )
    } else {
        lines.push(
            `${color.error('│')}`,
            `${color.error('│')}  ${color.dim('Set KONTEKS_DEBUG=1 to show the stack trace.')}`,
        )
    }

    if (logged) {
        lines.push(
            `${color.error('│')}`,
            `${color.error('│')}  ${color.dim('Details were written to .konteks/errors.log.')}`,
        )
    }

    lines.push(`${color.error('╰─')}`)

    return lines.join('\n')
}

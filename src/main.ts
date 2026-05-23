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
import getVersion from '@/support/get-version'

export function createCliProgram(): Command {
    const VERSION = getVersion()

    const program = new Command()
        .name('konteks')
        .description(
            `Konteks ${VERSION} - Project-local context memory for AI coding agents.`,
        )
        .version(VERSION)

    configureCliHelp(program)

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

createCliProgram()
    .parseAsync(process.argv)
    .catch(error => {
        printCliError(error)
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

function printCliError(error: unknown): void {
    consoleOutput.writeError(color => {
        const output =
            error instanceof CliUserError
                ? formatUserError(error, color)
                : formatUnexpectedError(error, color)

        return `${output}\n`
    })
}

function formatUserError(
    error: CliUserError,
    color: ConsoleColorPalette,
): string {
    const lines = [
        `${color.danger('╭─')} ${color.danger(error.title)}`,
        `${color.danger('│')}`,
        `${color.danger('│')}  ${error.message}`,
    ]

    if (error.command) {
        lines.push(
            `${color.danger('│')}`,
            `${color.danger('│')}  ${color.dim('Run')}`,
            `${color.danger('│')}    ${color.accent(error.command)}`,
        )
    }

    if (error.hint) {
        lines.push(
            `${color.danger('│')}`,
            `${color.danger('│')}  ${color.warning(error.hint)}`,
        )
    }

    lines.push(`${color.danger('╰─')}`)

    return lines.join('\n')
}

function formatUnexpectedError(
    error: unknown,
    color: ConsoleColorPalette,
): string {
    const message = error instanceof Error ? error.message : String(error)
    const lines = [
        `${color.danger('╭─')} ${color.danger('Konteks command failed')}`,
        `${color.danger('│')}`,
        `${color.danger('│')}  ${message || 'Unknown error'}`,
    ]

    if (error instanceof Error && process.env.KONTEKS_DEBUG && error.stack) {
        lines.push(
            `${color.danger('│')}`,
            ...error.stack
                .split('\n')
                .slice(1)
                .map(line => `${color.danger('│')}  ${color.dim(line.trim())}`),
        )
    } else {
        lines.push(
            `${color.danger('│')}`,
            `${color.danger('│')}  ${color.dim('Set KONTEKS_DEBUG=1 to show the stack trace.')}`,
        )
    }

    lines.push(`${color.danger('╰─')}`)

    return lines.join('\n')
}

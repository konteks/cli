#!/usr/bin/env node
import { Command } from 'commander'
import { commands, memoryCommands } from '@/commands'
import type { BaseCommandContext } from '@/commands/_base-command'
import { projectMemoryDatabasePath } from '@/database/services/project-memory'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { loadProjectContext, pathExists } from '@/providers/project/context'
import CliUserError from '@/support/cli/cli-user-error'
import getVersion from '@/support/get-version'
import createColorPalette from '@/support/terminal/create-color-palette'
import { terminal } from '@/support/terminal/service'

export function createCliProgram(): Command {
    const VERSION = getVersion()

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
    const color = createColorPalette(terminal.stderrSupportsColor())
    const output =
        error instanceof CliUserError
            ? formatUserError(error, color)
            : formatUnexpectedError(error, color)

    terminal.writeError(`${output}\n`)
}

function formatUserError(
    error: CliUserError,
    color: ReturnType<typeof createColorPalette>,
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
    color: ReturnType<typeof createColorPalette>,
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

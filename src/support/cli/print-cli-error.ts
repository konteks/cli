import CliUserError from '@/support/cli/cli-user-error'
import createColorPalette from '@/support/terminal/create-color-palette'
import { terminal } from '@/support/terminal/service'

export default function printCliError(error: unknown): void {
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

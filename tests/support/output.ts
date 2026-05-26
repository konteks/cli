import consoleOutput, {
    type ConsoleColorPalette,
    type ConsoleOutputMessage,
} from '@/support/console-output'

export function renderStdoutMessage(message: ConsoleOutputMessage): string {
    return isOutputFormatter(message)
        ? consoleOutput.withStdoutColor(message)
        : String(message)
}

export function stripAnsi(value: string): string {
    const ansiPattern = new RegExp(
        `${String.fromCharCode(27)}\\[[0-9;]*m`,
        'gu',
    )
    return value.replaceAll(ansiPattern, '')
}

function isOutputFormatter(
    message: ConsoleOutputMessage,
): message is (color: ConsoleColorPalette) => string {
    return typeof message === 'function'
}

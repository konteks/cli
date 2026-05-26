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

export function parseJsonFromOutput<T>(output: string): T {
    for (let index = 0; index < output.length; index += 1) {
        const char = output[index]
        if (char !== '{' && char !== '[' && char !== '"') {
            continue
        }

        try {
            return JSON.parse(output.slice(index)) as T
        } catch {}
    }

    throw new Error(`Expected JSON output, got:\n${output}`)
}

function isOutputFormatter(
    message: ConsoleOutputMessage,
): message is (color: ConsoleColorPalette) => string {
    return typeof message === 'function'
}

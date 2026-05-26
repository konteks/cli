import { encode } from '@toon-format/toon'

export type ConsoleColorPalette = {
    accent(value: string): string
    danger(value: string): string
    dim(value: string): string
    info(value: string): string
    success(value: string): string
    warning(value: string): string
}

export type ConsoleOutputMessage =
    | object
    | string
    | ((palette: ConsoleColorPalette) => string)

type WritableStream = {
    isTTY?: boolean
    write(section: string): unknown
}

type ReadableStream = {
    isTTY?: boolean
}

type TerminalEnvironment = Record<string, string | undefined>

class ConsoleOutput {
    public constructor(
        private readonly stdout: WritableStream = process.stdout,
        private readonly stderr: WritableStream = process.stderr,
        private readonly stdin: ReadableStream = process.stdin,
        private readonly env: TerminalEnvironment = process.env,
    ) {}

    public print(message: ConsoleOutputMessage): this {
        console.log(this.resolveMessage(message, this.stdoutPalette()))
        return this
    }

    public error(message: string, detail?: unknown): void {
        if (detail === undefined) {
            console.error(message)
            return
        }

        console.error(message, detail)
    }

    public writeError(
        message: string | ((palette: ConsoleColorPalette) => string),
    ): this {
        this.stderr.write(this.resolveText(message, this.stderrPalette()))
        return this
    }

    public toon(value: object | string): this {
        const output = typeof value === 'string' ? value : encode(value)

        return this.print(color => highlightToon(output, color))
    }

    public withStdoutColor<Value>(
        format: (palette: ConsoleColorPalette) => Value,
    ): Value {
        return format(this.stdoutPalette())
    }

    public withStderrColor<Value>(
        format: (palette: ConsoleColorPalette) => Value,
    ): Value {
        return format(this.stderrPalette())
    }

    public stderrIsInteractive(): boolean {
        return Boolean(this.stderr.isTTY)
    }

    public stdinIsInteractive(): boolean {
        return Boolean(this.stdin.isTTY)
    }

    private supportsColor(stream: WritableStream): boolean {
        if (this.env.NO_COLOR) {
            return false
        }

        if (this.env.FORCE_COLOR && this.env.FORCE_COLOR !== '0') {
            return true
        }

        return Boolean(stream.isTTY)
    }

    private stdoutPalette(): ConsoleColorPalette {
        return this.createPalette(this.supportsColor(this.stdout))
    }

    private stderrPalette(): ConsoleColorPalette {
        return this.createPalette(this.supportsColor(this.stderr))
    }

    private createPalette(enabled: boolean): ConsoleColorPalette {
        function wrap(code: number, value: string): string {
            return enabled ? `\u001b[${code}m${value}\u001b[0m` : value
        }

        return {
            accent: value => wrap(36, value),
            danger: value => wrap(31, value),
            dim: value => wrap(90, value),
            info: value => wrap(34, value),
            success: value => wrap(32, value),
            warning: value => wrap(33, value),
        }
    }

    private resolveMessage(
        message: ConsoleOutputMessage,
        palette: ConsoleColorPalette,
    ): object | string {
        return typeof message === 'function' ? message(palette) : message
    }

    private resolveText(
        message: string | ((palette: ConsoleColorPalette) => string),
        palette: ConsoleColorPalette,
    ): string {
        return typeof message === 'function' ? message(palette) : message
    }
}

function highlightToon(value: string, color: ConsoleColorPalette): string {
    return value
        .split('\n')
        .map(line => highlightToonLine(line, color))
        .join('\n')
}

function highlightToonLine(line: string, color: ConsoleColorPalette): string {
    const keyValue = line.match(
        /^(\s*(?:-\s*)?)([^:\n]+?)(\[[^\]]+\])?(\{[^}]+\})?(:)(\s*)(.*)$/u,
    )

    if (keyValue) {
        const [, prefix, key, arraySize = '', fields = '', colon, gap, value] =
            keyValue

        return [
            prefix,
            color.accent(key),
            arraySize ? color.dim(arraySize) : '',
            fields ? color.dim(fields) : '',
            color.dim(colon),
            gap,
            highlightToonValue(value, color),
        ].join('')
    }

    const listItem = line.match(/^(\s*-\s+)(.*)$/u)

    if (listItem) {
        const [, prefix, value] = listItem

        return `${prefix}${highlightToonValue(value, color)}`
    }

    return highlightToonValue(line, color)
}

function highlightToonValue(value: string, color: ConsoleColorPalette): string {
    if (/^(true|false)$/u.test(value)) {
        return color.success(value)
    }

    if (value === 'null') {
        return color.dim(value)
    }

    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) {
        return color.info(value)
    }

    if (value === '[]') {
        return color.dim(value)
    }

    return value
}

export default new ConsoleOutput()

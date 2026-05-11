import { stringifyPretty } from './json'

type WritableStream = {
    isTTY?: boolean
    write(chunk: string): unknown
}

type ReadableStream = {
    isTTY?: boolean
}

type TerminalEnvironment = Record<string, string | undefined>

class TerminalService {
    constructor(
        private readonly stdout: WritableStream = process.stdout,
        private readonly stderr: WritableStream = process.stderr,
        private readonly stdin: ReadableStream = process.stdin,
        private readonly env: TerminalEnvironment = process.env,
    ) {}

    log(message: string): void {
        console.log(message)
    }

    error(message: string, detail?: unknown): void {
        if (detail === undefined) {
            console.error(message)
            return
        }

        console.error(message, detail)
    }

    writeError(message: string): void {
        this.stderr.write(message)
    }

    json(value: unknown): void {
        this.log(stringifyPretty(value))
    }

    stdoutSupportsColor(): boolean {
        return Boolean(this.stdout.isTTY && !this.env.NO_COLOR)
    }

    stderrSupportsColor(): boolean {
        return Boolean(this.stderr.isTTY && !this.env.NO_COLOR)
    }

    stderrIsInteractive(): boolean {
        return Boolean(this.stderr.isTTY)
    }

    stdinIsInteractive(): boolean {
        return Boolean(this.stdin.isTTY)
    }
}

export const terminal = new TerminalService()

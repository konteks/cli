import { stringifyPretty } from '@/support/json/io'

type WritableStream = {
    isTTY?: boolean
    write(chunk: string): unknown
}

type ReadableStream = {
    isTTY?: boolean
}

type TerminalEnvironment = Record<string, string | undefined>

class TerminalService {
    public constructor(
        private readonly stdout: WritableStream = process.stdout,
        private readonly stderr: WritableStream = process.stderr,
        private readonly stdin: ReadableStream = process.stdin,
        private readonly env: TerminalEnvironment = process.env,
    ) {}

    public log(message: string): void {
        console.log(message)
    }

    public error(message: string, detail?: unknown): void {
        if (detail === undefined) {
            console.error(message)
            return
        }

        console.error(message, detail)
    }

    public writeError(message: string): void {
        this.stderr.write(message)
    }

    public json(value: unknown): void {
        this.log(stringifyPretty(value))
    }

    public stdoutSupportsColor(): boolean {
        return this.supportsColor(this.stdout)
    }

    public stderrSupportsColor(): boolean {
        return this.supportsColor(this.stderr)
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
}

export const terminal = new TerminalService()

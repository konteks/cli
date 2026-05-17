export type CliUserErrorOptions = {
    command?: string
    hint?: string
    message: string
    title: string
}

export default class CliUserError extends Error {
    public readonly command?: string
    public readonly hint?: string
    public readonly title: string

    public constructor(options: CliUserErrorOptions) {
        super(options.message)
        this.name = 'CliUserError'
        this.command = options.command
        this.hint = options.hint
        this.title = options.title
    }
}

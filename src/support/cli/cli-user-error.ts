export type CliUserErrorOptions = {
    command?: string
    hint?: string
    message: string
    title: string
}

export default class CliUserError extends Error {
    readonly command?: string
    readonly hint?: string
    readonly title: string

    constructor(options: CliUserErrorOptions) {
        super(options.message)
        this.name = 'CliUserError'
        this.command = options.command
        this.hint = options.hint
        this.title = options.title
    }
}

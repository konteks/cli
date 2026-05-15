import type { Command as CommanderCommand } from 'commander'
import type { GlobalCliOptions } from '@/models/cli'
import { terminal } from '@/support/terminal/service'
import { VERSION } from '@/support/version'

export type Command = CommanderCommand

export type BaseCommandContext = {
    ensureInitialized: (project?: string) => Promise<void>
    getGlobalOptions: () => GlobalCliOptions
}

export type BaseCommandRegistrar = {
    readonly name: string
    register(parent: Command, context: BaseCommandContext): Command
}

export type BaseCommandInput<
    Args extends unknown[] = unknown[],
    Options extends object = Record<string, never>,
> = {
    args: Args
    globalOptions: GlobalCliOptions
    options: Options
}

type BaseCommandMetadata = {
    description: string
    name: string
    printsHeader?: boolean
    requiresProject?: boolean
}

export default abstract class BaseCommand<
    Args extends unknown[] = unknown[],
    Options extends object = Record<string, never>,
> {
    readonly description: string
    readonly name: string
    readonly printsHeader: boolean
    readonly requiresProject: boolean

    protected constructor(metadata: BaseCommandMetadata) {
        this.description = metadata.description
        this.name = metadata.name
        this.printsHeader = metadata.printsHeader ?? false
        this.requiresProject = metadata.requiresProject ?? true
    }

    register(parent: Command, context: BaseCommandContext): Command {
        const command = parent.command(this.name).description(this.description)
        this.configure(command)
        command.action(async (...values: unknown[]) => {
            const commandOptions = command.opts<Options>()
            const args = stripCommanderActionValues(
                values.slice(0, -1),
                commandOptions,
            ) as Args
            const globalOptions = context.getGlobalOptions()

            if (this.printsHeader) {
                terminal.log(`Konteks v${VERSION}`)
            }

            if (this.requiresProject) {
                await context.ensureInitialized(globalOptions.project)
            }

            await this.handle({
                args,
                globalOptions,
                options: commandOptions,
            })
        })

        return command
    }

    protected configure(_command: Command): void {}

    protected print(value: string): void {
        terminal.log(value)
    }

    abstract handle(
        input: BaseCommandInput<Args, Options>,
    ): Promise<void> | void
}

function stripCommanderActionValues<Options extends object>(
    values: unknown[],
    options: Options,
): unknown[] {
    const lastValue = values.at(-1)
    if (lastValue === options || isPlainObject(lastValue)) {
        return values.slice(0, -1)
    }

    return values
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype
    )
}

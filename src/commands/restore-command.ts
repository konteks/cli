import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { restoreMemory } from '@/composition/memory-transfer'
import { stringifyPretty } from '@/support/json/io'

type RestoreOptions = {
    force?: boolean
}

export default class RestoreCommand extends BaseCommand<
    [string],
    RestoreOptions
> {
    override readonly args = [
        {
            description: 'Input .tar.gz file',
            name: '<file>',
        },
    ]
    readonly description = 'Restore a full .konteks backup archive.'
    readonly name = 'restore'
    override readonly options = [
        {
            description: 'Replace a non-empty memory directory.',
            flags: '--force',
        },
    ]
    override readonly usesInitializationGuard = false

    async handle({
        args,
        globalOptions,
        options,
    }: BaseCommandInput<[string], RestoreOptions>): Promise<void> {
        this.print(
            stringifyPretty(
                await restoreMemory({
                    force: options.force,
                    inputPath: args[0],
                    project: globalOptions.project,
                }),
            ),
        )
    }
}

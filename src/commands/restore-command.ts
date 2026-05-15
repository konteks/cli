import type { BaseCommandInput, Command } from '@/commands/_base-command'
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
    constructor() {
        super({
            description: 'Restore a full .konteks backup archive.',
            name: 'restore',
            printsHeader: true,
            requiresProject: false,
        })
    }

    protected override configure(command: Command): void {
        command
            .argument('<file>', 'Input .tar.gz file')
            .option('--force', 'Replace a non-empty memory directory.')
    }

    override async handle({
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

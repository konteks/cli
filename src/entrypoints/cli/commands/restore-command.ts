import { restoreMemory } from '@/modules/memory/memory-transfer'
import type { BaseCommandInput } from './_base-command'
import BaseCommand from './_base-command'

type RestoreOptions = {
    force?: boolean
}

export default class RestoreCommand extends BaseCommand<
    [string],
    RestoreOptions
> {
    public override readonly args = [
        {
            description: 'Input .tar.gz file',
            name: '<file>',
        },
    ]
    public readonly description = 'Restore a full .konteks backup archive.'
    public readonly name = 'restore'
    public override readonly options = [
        {
            description: 'Replace a non-empty memory directory.',
            flags: '--force',
        },
    ]
    public override readonly usesInitializationGuard = false

    public async handle({
        args,
        options,
    }: Required<BaseCommandInput<[string], RestoreOptions>>): Promise<void> {
        this.print(
            await restoreMemory({
                force: options.force,
                inputPath: args[0],
            }),
        )
    }
}

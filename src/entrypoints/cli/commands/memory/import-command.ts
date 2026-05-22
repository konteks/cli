import { importMemory } from '@/modules/memory/memory-transfer'
import { stringifyPretty } from '@/support/json/io'
import BaseCommand, { type BaseCommandInput } from '../_base-command'

type MemoryImportOptions = {
    dryRun?: boolean
}

export default class ImportCommand extends BaseCommand<
    [string],
    MemoryImportOptions
> {
    public override readonly args = [
        {
            description: 'Input JSON file',
            name: '<file>',
        },
    ]
    public readonly description =
        'Import durable memories and diary entries from JSON.'
    public readonly name = 'import'
    public override readonly options = [
        {
            description: 'Validate and report counts without writing.',
            flags: '--dry-run',
        },
    ]

    public async handle({
        args,
        options,
    }: Required<
        BaseCommandInput<[string], MemoryImportOptions>
    >): Promise<void> {
        this.print(
            stringifyPretty(
                await importMemory({
                    dryRun: options.dryRun,
                    inputPath: args[0],
                }),
            ),
        )
    }
}

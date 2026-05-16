import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { importMemory } from '@/composition/memory-transfer'
import { stringifyPretty } from '@/support/json/io'

type MemoryImportOptions = {
    dryRun?: boolean
}

export default class ImportCommand extends BaseCommand<
    [string],
    MemoryImportOptions
> {
    override readonly args = [
        {
            description: 'Input JSON file',
            name: '<file>',
        },
    ]
    readonly description =
        'Import durable memories and diary entries from JSON.'
    readonly name = 'import'
    override readonly options = [
        {
            description: 'Validate and report counts without writing.',
            flags: '--dry-run',
        },
    ]

    async handle({
        args,
        globalOptions,
        options,
    }: BaseCommandInput<[string], MemoryImportOptions>): Promise<void> {
        this.print(
            stringifyPretty(
                await importMemory({
                    dryRun: options.dryRun,
                    inputPath: args[0],
                    project: globalOptions.project,
                }),
            ),
        )
    }
}

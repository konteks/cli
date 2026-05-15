import type { BaseCommandInput, Command } from '@/commands/_base-command'
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
    constructor() {
        super({
            description: 'Import durable memories and diary entries from JSON.',
            name: 'import',
            printsHeader: true,
        })
    }

    protected override configure(command: Command): void {
        command
            .argument('<file>', 'Input JSON file')
            .option('--dry-run', 'Validate and report counts without writing.')
    }

    override async handle({
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

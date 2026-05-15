import type { BaseCommandInput, Command } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { exportMemory } from '@/composition/memory-transfer'
import { stringifyPretty } from '@/support/json/io'

type MemoryExportOptions = {
    includeInactive?: boolean
}

export default class ExportCommand extends BaseCommand<
    [string],
    MemoryExportOptions
> {
    constructor() {
        super({
            description: 'Export durable memories and diary entries to JSON.',
            name: 'export',
            printsHeader: true,
        })
    }

    protected override configure(command: Command): void {
        command
            .argument('<file>', 'Output JSON file')
            .option(
                '--include-inactive',
                'Include soft-deleted or suppressed durable memory.',
            )
    }

    override async handle({
        args,
        globalOptions,
        options,
    }: BaseCommandInput<[string], MemoryExportOptions>): Promise<void> {
        this.print(
            stringifyPretty(
                await exportMemory({
                    includeInactive: options.includeInactive,
                    outputPath: args[0],
                    project: globalOptions.project,
                }),
            ),
        )
    }
}

import { exportMemory } from '@/modules/memory/memory-transfer'
import { stringifyPretty } from '@/support/json/io'
import BaseCommand, { type BaseCommandInput } from '../_base-command'

type MemoryExportOptions = {
    includeInactive?: boolean
}

export default class ExportCommand extends BaseCommand<
    [string],
    MemoryExportOptions
> {
    public override readonly args = [
        {
            description: 'Output JSON file',
            name: '<file>',
        },
    ]
    public readonly description =
        'Export durable memories and diary entries to JSON.'
    public readonly name = 'export'
    public override readonly options = [
        {
            description: 'Include soft-deleted or suppressed durable memory.',
            flags: '--include-inactive',
        },
    ]

    public async handle({
        args,
        options,
    }: Required<
        BaseCommandInput<[string], MemoryExportOptions>
    >): Promise<void> {
        this.print(
            stringifyPretty(
                await exportMemory({
                    includeInactive: options.includeInactive,
                    outputPath: args[0],
                }),
            ),
        )
    }
}

import type { BaseCommandInput } from '@/commands/_base-command'
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
    override readonly args = [
        {
            description: 'Output JSON file',
            name: '<file>',
        },
    ]
    readonly description = 'Export durable memories and diary entries to JSON.'
    readonly name = 'export'
    override readonly options = [
        {
            description: 'Include soft-deleted or suppressed durable memory.',
            flags: '--include-inactive',
        },
    ]

    async handle({
        args,
        options,
    }: BaseCommandInput<[string], MemoryExportOptions>): Promise<void> {
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

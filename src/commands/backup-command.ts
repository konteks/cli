import type { BaseCommandInput, Command } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { backupMemory } from '@/composition/memory-transfer'
import { stringifyPretty } from '@/support/json/io'

export default class BackupCommand extends BaseCommand<[string]> {
    constructor() {
        super({
            description: 'Create a full .konteks backup archive.',
            name: 'backup',
            printsHeader: true,
        })
    }

    protected override configure(command: Command): void {
        command.argument('<file>', 'Output .tar.gz file')
    }

    override async handle({
        args,
        globalOptions,
    }: BaseCommandInput<[string]>): Promise<void> {
        this.print(
            stringifyPretty(
                await backupMemory({
                    outputPath: args[0],
                    project: globalOptions.project,
                }),
            ),
        )
    }
}

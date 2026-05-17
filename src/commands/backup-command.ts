import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { backupMemory } from '@/composition/memory-transfer'
import { stringifyPretty } from '@/support/json/io'

export default class BackupCommand extends BaseCommand<[string]> {
    public override readonly args = [
        {
            description: 'Output .tar.gz file',
            name: '<file>',
        },
    ]
    public readonly description = 'Create a full .konteks backup archive.'
    public readonly name = 'backup'

    public async handle({
        args,
    }: Required<BaseCommandInput<[string]>>): Promise<void> {
        this.print(
            stringifyPretty(
                await backupMemory({
                    outputPath: args[0],
                }),
            ),
        )
    }
}

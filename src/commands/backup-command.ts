import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { backupMemory } from '@/composition/memory-transfer'
import { stringifyPretty } from '@/support/json/io'

export default class BackupCommand extends BaseCommand<[string]> {
    override readonly args = [
        {
            description: 'Output .tar.gz file',
            name: '<file>',
        },
    ]
    readonly description = 'Create a full .konteks backup archive.'
    readonly name = 'backup'

    async handle({ args }: BaseCommandInput<[string]>): Promise<void> {
        this.print(
            stringifyPretty(
                await backupMemory({
                    outputPath: args[0],
                }),
            ),
        )
    }
}

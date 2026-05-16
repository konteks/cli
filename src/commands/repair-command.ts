import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import repairMemory from '@/project/repair-memory'
import { stringifyPretty } from '@/support/json/io'

export default class RepairCommand extends BaseCommand {
    readonly description =
        'Repair Konteks memory by rebuilding artifacts from scratch.'
    readonly name = 'repair'

    async handle({ globalOptions }: BaseCommandInput): Promise<void> {
        this.print(stringifyPretty(await repairMemory(globalOptions)))
    }
}

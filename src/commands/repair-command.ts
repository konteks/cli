import BaseCommand from '@/commands/_base-command'
import repairMemory from '@/project/repair-memory'
import { stringifyPretty } from '@/support/json/io'

export default class RepairCommand extends BaseCommand {
    public readonly description =
        'Repair Konteks memory by rebuilding artifacts from scratch.'
    public readonly name = 'repair'

    public async handle(): Promise<void> {
        this.print(stringifyPretty(await repairMemory()))
    }
}

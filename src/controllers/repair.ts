import type { GlobalCliOptions } from '@/models/cli'
import { repairMemory } from '@/project/repair'
import { stringifyPretty } from '@/support/json/io'
import { terminal } from '@/support/terminal/service'

export async function repairCommand(options: GlobalCliOptions): Promise<void> {
    printRepairResult(await repairMemory(options))
}

function printRepairResult(value: unknown): void {
    terminal.log(stringifyPretty(value))
}

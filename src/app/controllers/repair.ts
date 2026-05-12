import { repairMemory } from '@/app/composition/memory-repair'
import type { GlobalCliOptions } from '@/app/models/cli'
import { stringifyPretty } from '@/app/support/json/io'
import { terminal } from '@/app/support/terminal/service'

export async function repairCommand(options: GlobalCliOptions): Promise<void> {
    printMineResult(await repairMemory(options))
}

function printMineResult(value: unknown): void {
    terminal.log(stringifyPretty(value))
}

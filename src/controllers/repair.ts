import type { GlobalCliOptions } from '@/app/models/cli'
import { repairMemory } from '@/composition/memory-repair'
import { stringifyPretty } from '@/support/json/io'
import { terminal } from '@/support/terminal/service'

export async function repairCommand(options: GlobalCliOptions): Promise<void> {
    printMineResult(await repairMemory(options))
}

function printMineResult(value: unknown): void {
    terminal.log(stringifyPretty(value))
}

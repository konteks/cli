import type { GlobalCliOptions } from '@/models/cli'
import { openConfigTui } from '@/providers/cli/grammar-selection'

export async function configCommand(options: GlobalCliOptions): Promise<void> {
    await openConfigTui(options.project)
}

import type { MineMode, MineProjectResponse } from '@/app/models/mining'
import { confirmInteractive } from '@/app/providers/cli/interactive-confirm'
import { createMineProgressReporter } from '@/app/providers/extraction/progress-reporter'
import { createMiningAction } from './mining'

export type RepairMemoryOptions = {
    project?: string
}

export type RepairMemoryResult =
    | {
          mode: 'repair'
          ok: false
          skipped: true
      }
    | (Omit<MineProjectResponse, 'mode'> & {
          mode: 'repair'
      })

export async function repairMemory(
    options: RepairMemoryOptions,
): Promise<RepairMemoryResult> {
    if (!(await confirmRepair())) {
        return { mode: 'repair', ok: false, skipped: true }
    }

    const progress = createMineProgressReporter()
    try {
        const action = createMiningAction({
            onProgress: progress.report,
        })

        const result = await action.execute({
            mode: 'reindex' as MineMode,
            projectRoot: options.project || process.cwd(),
        })

        return {
            ...result,
            mode: 'repair',
        }
    } finally {
        progress.done()
    }
}

async function confirmRepair(): Promise<boolean> {
    return await confirmInteractive(
        'Repair Konteks memory by rebuilding artifacts for this project?',
        true,
    )
}

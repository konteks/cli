import type {
    ExtractionMode,
    ExtractProjectResponse,
} from '@/models/extraction'
import { confirmInteractive } from '@/providers/cli/interactive-confirm'
import { createExtractionProgressReporter } from '@/providers/extraction/progress-reporter'
import { createExtractionAction } from './extraction'

export type RepairMemoryOptions = {
    project?: string
}

export type RepairMemoryResult =
    | {
          mode: 'repair'
          ok: false
          skipped: true
      }
    | (Omit<ExtractProjectResponse, 'mode'> & {
          mode: 'repair'
      })

export async function repairMemory(
    options: RepairMemoryOptions,
): Promise<RepairMemoryResult> {
    if (!(await confirmRepair())) {
        return { mode: 'repair', ok: false, skipped: true }
    }

    const progress = createExtractionProgressReporter()
    try {
        const action = createExtractionAction({
            onProgress: progress.report,
        })

        const result = await action.execute({
            mode: 'reindex' as ExtractionMode,
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

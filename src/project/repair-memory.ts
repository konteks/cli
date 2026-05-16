import createProjectExtractor, {
    type ProjectExtractor,
} from '@/extraction/create-project-extractor'
import type {
    ExtractionMode,
    ExtractProjectResponse,
} from '@/models/extraction'
import confirmInteractive from '@/providers/cli/confirm-interactive'
import createExtractionProgressReporter from '@/providers/extraction/create-extraction-progress-reporter'

export type RepairMemoryDependencies = {
    confirmRepair?: () => Promise<boolean>
    extractor?: ProjectExtractor
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

export default async function repairMemory(
    dependencies: RepairMemoryDependencies = {},
): Promise<RepairMemoryResult> {
    const confirmRepair = dependencies.confirmRepair ?? confirmRepairPrompt
    if (!(await confirmRepair())) {
        return { mode: 'repair', ok: false, skipped: true }
    }

    const progress = createExtractionProgressReporter()
    try {
        const extractor =
            dependencies.extractor ??
            createProjectExtractor({
                onProgress: progress.report,
            })

        const result = await extractor.execute({
            mode: 'reindex' as ExtractionMode,
            projectRoot: process.cwd(),
        })

        return {
            ...result,
            mode: 'repair',
        }
    } finally {
        progress.done()
    }
}

async function confirmRepairPrompt(): Promise<boolean> {
    return await confirmInteractive(
        'Repair Konteks memory by rebuilding artifacts for this project?',
        true,
    )
}

import BaseCommand from '@/commands/_base-command'
import createProjectExtractor from '@/extraction/create-project-extractor'
import type { ExtractionMode } from '@/models/extraction'
import confirmInteractive from '@/providers/cli/confirm-interactive'
import createExtractionProgressReporter from '@/providers/extraction/create-extraction-progress-reporter'
import { stringifyPretty } from '@/support/json/io'

export default class RepairCommand extends BaseCommand {
    public readonly description =
        'Repair Konteks memory by rebuilding artifacts from scratch.'
    public readonly name = 'repair'

    public async handle(): Promise<void> {
        const confirmRepair = confirmRepairPrompt
        if (!(await confirmRepair())) {
            this.print(
                stringifyPretty({ mode: 'repair', ok: false, skipped: true }),
            )

            return
        }

        const progress = createExtractionProgressReporter()
        try {
            const extractor = createProjectExtractor({
                onProgress: progress.report,
            })

            const result = await extractor.execute({
                mode: 'reindex' as ExtractionMode,
                projectRoot: process.cwd(),
            })

            this.print(
                stringifyPretty({
                    ...result,
                    mode: 'repair',
                }),
            )
        } finally {
            progress.done()
        }
    }
}

async function confirmRepairPrompt(): Promise<boolean> {
    return await confirmInteractive(
        'Repair Konteks memory by rebuilding artifacts for this project?',
        true,
    )
}

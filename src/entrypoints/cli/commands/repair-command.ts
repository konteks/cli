import { confirm } from '@inquirer/prompts'
import createExtractionProgressReporter from '@/modules/extraction/create-extraction-progress-reporter'
import createProjectExtractor from '@/modules/extraction/create-project-extractor'
import { stringifyPretty } from '@/support/json/io'
import { terminal } from '@/support/terminal/service'
import BaseCommand from './_base-command'

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
                mode: 'reindex',
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
    if (!terminal.stdinIsInteractive() || !terminal.stderrIsInteractive()) {
        return true
    }

    return await confirm({
        default: true,
        message:
            'Repair Konteks memory by rebuilding artifacts for this project?',
    })
}

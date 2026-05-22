import { confirm } from '@inquirer/prompts'
import createExtractionProgressReporter from '@/modules/extraction/create-extraction-progress-reporter'
import createProjectExtractor from '@/modules/extraction/create-project-extractor'
import { stringifyPretty } from '@/support/json/io'
import { terminal } from '@/support/terminal/service'
import BaseCommand from './_base-command'

export default class RebuildCommand extends BaseCommand {
    public readonly description =
        'Rebuild derived Konteks memory artifacts from scratch.'
    public readonly name = 'rebuild'

    public async handle(): Promise<void> {
        const confirmRebuild = confirmRebuildPrompt
        if (!(await confirmRebuild())) {
            this.print(
                stringifyPretty({ mode: 'rebuild', ok: false, skipped: true }),
            )

            return
        }

        const progress = createExtractionProgressReporter()
        try {
            const extractor = createProjectExtractor({
                onProgress: progress.report,
            })

            const result = await extractor.execute({
                mode: 'rebuild',
                projectRoot: process.cwd(),
            })

            this.print(
                stringifyPretty({
                    ...result,
                    mode: 'rebuild',
                }),
            )
        } finally {
            progress.done()
        }
    }
}

async function confirmRebuildPrompt(): Promise<boolean> {
    if (!terminal.stdinIsInteractive() || !terminal.stderrIsInteractive()) {
        return true
    }

    return await confirm({
        default: true,
        message:
            'Rebuild derived memory for this project? Durable memories and diary entries are preserved.',
    })
}

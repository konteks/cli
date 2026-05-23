import { confirm } from '@inquirer/prompts'
import createProjectExtractor from '@/modules/extraction/create-project-extractor'
import consoleOutput from '@/support/console-output'
import BaseCommand from './_base-command'
import createProjectMemoryProgressReporter from './_support/project-memory-progress-reporter'

export default class RebuildCommand extends BaseCommand {
    public readonly description =
        'Rebuild derived Konteks memory artifacts from scratch.'
    public readonly name = 'rebuild'

    public async handle(): Promise<void> {
        const confirmRebuild = confirmRebuildPrompt
        if (!(await confirmRebuild())) {
            this.print('Rebuild canceled. Derived memory was not changed.')

            return
        }

        this.print('')
        this.print('Rebuilding project memory')
        this.print('')

        const progress = createProjectMemoryProgressReporter()
        try {
            const extractor = createProjectExtractor({
                onProgress: progress.report,
            })

            const result = await extractor.execute({
                mode: 'rebuild',
                projectRoot: process.cwd(),
            })

            progress.summary(result)
        } finally {
            progress.done()
        }
    }
}

async function confirmRebuildPrompt(): Promise<boolean> {
    if (
        !consoleOutput.stdinIsInteractive() ||
        !consoleOutput.stderrIsInteractive()
    ) {
        return true
    }

    return await confirm({
        default: true,
        message:
            'Rebuild derived memory for this project? Durable memories and diary entries are preserved.',
    })
}

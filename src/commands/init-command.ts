import BaseCommand from '@/commands/_base-command'
import createInitProgressReporter from '@/commands/init-progress-reporter'
import { reviewDetectedGrammars } from '@/providers/cli/grammar-selection'
import { scanProjectFiles } from '@/providers/extraction/engine/file-scan'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { loadProjectContext } from '@/providers/project/context'
import initializeProjectMemory from '@/providers/project/initialize-project-memory'

export default class InitCommand extends BaseCommand {
    public readonly description =
        'Initialize memory, section the project, and build indexes.'
    public readonly name = 'init'
    public override readonly usesInitializationGuard = false

    public async handle(): Promise<void> {
        const context = await loadProjectContext()

        const alreadyInitialized =
            context.configExists &&
            (await readExtractionManifest(context.memoryDir))
        const progress = createInitProgressReporter()
        let grammars: string[] | undefined
        if (!alreadyInitialized) {
            this.print('')
            this.print('Initializing project memory')
            this.print('')

            const files = await scanProjectFiles(context.projectRoot)
            const selection = await reviewDetectedGrammars(files)
            if (selection.reviewedInteractively) {
                progress.skipDetectedLanguageCheck()
            }
            grammars = selection.selectedRegistryParserIds
        }
        const result = await initializeProjectMemory({
            context,
            grammars,
            onProgress: progress.report,
        }).finally(progress.done)
        if (result.alreadyInitialized) {
            this.print(
                `Project memory is already ready at ${result.memoryDir}.`,
            )
            return
        }

        progress.summary(result.extraction)
    }
}

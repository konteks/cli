import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import initializeProject from '@/project/initialize-project'
import resolveInitialGrammars from '@/project/resolve-initial-grammars'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { loadProjectContext } from '@/providers/project/context'

export default class InitCommand extends BaseCommand {
    readonly description =
        'Initialize memory, section the project, and build indexes.'
    readonly name = 'init'
    override readonly usesInitializationGuard = false

    async handle(_input: BaseCommandInput): Promise<void> {
        const context = await loadProjectContext()
        const alreadyInitialized =
            context.configExists &&
            (await readExtractionManifest(context.memoryDir))
        const grammars = alreadyInitialized
            ? undefined
            : await resolveInitialGrammars(context.projectRoot)
        const result = await initializeProject({ grammars })
        if (result.alreadyInitialized) {
            this.print(
                `Konteks is already initialized at ${result.memoryDir}. Use 'konteks repair' if memory artifacts need recovery.`,
            )
            return
        }

        this.print(`Initialized Konteks at ${result.memoryDir}`)
        this.print(
            `Extracted ${result.extraction.fileCount} files into ${result.extraction.chunkCount} sections`,
        )
    }
}

import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import initializeProject from '@/project/initialize-project'
import resolveInitialGrammars from '@/project/resolve-initial-grammars'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { loadProjectContext } from '@/providers/project/context'

export type InitCommandOptions = {
    embeddingProvider?: EmbeddingProviderContract
    grammar?: string[]
}

export default class InitCommand extends BaseCommand<
    [],
    { grammar?: string[] }
> {
    readonly description =
        'Initialize memory, section the project, and build indexes.'
    readonly name = 'init'
    override readonly options = [
        {
            description:
                'Select a Tree-sitter grammar during non-interactive init; repeatable.',
            flags: '--grammar <id>',
            parser: collectValues,
        },
    ]
    override readonly usesInitializationGuard = false

    async handle({
        options,
    }: BaseCommandInput<[], { grammar?: string[] }>): Promise<void> {
        await this.run(options)
    }

    async run(options: InitCommandOptions): Promise<void> {
        const context = await loadProjectContext()
        const alreadyInitialized =
            context.configExists &&
            (await readExtractionManifest(context.memoryDir))
        const grammars = alreadyInitialized
            ? undefined
            : await resolveInitialGrammars(context.projectRoot, options.grammar)
        const result = await initializeProject({ ...options, grammars })
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

function collectValues(value: string, previous: unknown): string[] {
    return [...(Array.isArray(previous) ? previous : []), value]
}

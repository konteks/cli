import type { BaseCommandInput, Command } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import type { GlobalCliOptions } from '@/models/cli'
import initializeProject from '@/project/initialize-project'
import resolveInitialGrammars from '@/project/resolve-initial-grammars'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { loadProjectContext } from '@/providers/project/context'

export type InitCommandOptions = GlobalCliOptions & {
    embeddingProvider?: EmbeddingProviderContract
    grammar?: string[]
}

export default class InitCommand extends BaseCommand<
    [],
    { grammar?: string[] }
> {
    constructor() {
        super({
            description:
                'Initialize memory, section the project, and build indexes.',
            name: 'init',
            printsHeader: true,
            requiresProject: false,
        })
    }

    protected override configure(command: Command): void {
        command.option(
            '--grammar <id>',
            'Select a Tree-sitter grammar during non-interactive init; repeatable.',
            collectValues,
        )
    }

    override async handle({
        globalOptions,
        options,
    }: BaseCommandInput<[], { grammar?: string[] }>): Promise<void> {
        await this.run({ ...globalOptions, ...options })
    }

    async run(options: InitCommandOptions): Promise<void> {
        const context = await loadProjectContext(options.project)
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

function collectValues(value: string, previous: string[]): string[] {
    return [...previous, value]
}

import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import type { GlobalCliOptions } from '@/models/cli'
import initializeProject from '@/project/initialize-project'
import resolveInitialGrammars from '@/project/resolve-initial-grammars'
import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { loadProjectContext } from '@/providers/project/context'
import { terminal } from '@/support/terminal/service'

type InitCommandOptions = GlobalCliOptions & {
    embeddingProvider?: EmbeddingProviderContract
    grammar?: string[]
}

export default async function initCommand(
    options: InitCommandOptions,
): Promise<void> {
    const context = await loadProjectContext(options.project)
    const alreadyInitialized =
        context.configExists &&
        (await readExtractionManifest(context.memoryDir))
    const grammars = alreadyInitialized
        ? undefined
        : await resolveInitialGrammars(context.projectRoot, options.grammar)
    const result = await initializeProject({ ...options, grammars })
    if (result.alreadyInitialized) {
        terminal.log(
            `Konteks is already initialized at ${result.memoryDir}. Use 'konteks repair' if memory artifacts need recovery.`,
        )
        return
    }

    terminal.log(`Initialized Konteks at ${result.memoryDir}`)
    terminal.log(
        `Extracted ${result.extraction.fileCount} files into ${result.extraction.chunkCount} sections`,
    )
}

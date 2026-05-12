import { initializeProject } from '@/composition/project-initialization'
import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import type { GlobalCliOptions } from '@/models/cli'
import { terminal } from '@/support/terminal/service'

type InitCommandOptions = GlobalCliOptions & {
    embeddingProvider?: EmbeddingProviderContract
}

export async function initCommand(options: InitCommandOptions): Promise<void> {
    const result = await initializeProject(options)
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

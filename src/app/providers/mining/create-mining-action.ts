import { MineProjectAction } from '@/app/actions/mine-project-action'
import type { EmbeddingProviderContract } from '@/app/contracts/services/embedding-provider'
import { HuggingFaceEmbeddingProvider } from '@/app/providers/ai/hugging-face-embedding-provider'
import type { MineProgressReporter } from '@/app/providers/mining/engine/progress'
import { FileSystemProjectRepository } from '@/app/repositories/file-system-project-repository'
import { KonteksMineEngine } from './mine-project'

export function createMiningAction(options: {
    embeddingProvider?: EmbeddingProviderContract
    onProgress?: MineProgressReporter
}): MineProjectAction {
    const embeddingProvider =
        options.embeddingProvider ??
        new HuggingFaceEmbeddingProvider({
            onProgress: options.onProgress,
        })
    const projectRepo = new FileSystemProjectRepository()
    const mineEngine = new KonteksMineEngine({
        embeddingProvider,
        onProgress: options.onProgress,
    })

    return new MineProjectAction(projectRepo, mineEngine)
}

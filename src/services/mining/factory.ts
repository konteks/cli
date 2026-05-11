import { MineProjectUseCase } from '@/application/use-cases/mine-project-use-case'
import type { EmbeddingProvider } from '@/infrastructure/ai/hugging-face-embedding-provider'
import { HuggingFaceEmbeddingProvider } from '@/infrastructure/ai/hugging-face-embedding-provider'
import { FileSystemProjectRepository } from '@/infrastructure/file-system/file-system-project-repository'
import type { MineProgressReporter } from '@/infrastructure/mining/progress'
import { KonteksMineEngine } from './mine-project'

export function createMiningUseCase(options: {
    embeddingProvider?: EmbeddingProvider
    onProgress?: MineProgressReporter
}): MineProjectUseCase {
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

    return new MineProjectUseCase(projectRepo, mineEngine)
}

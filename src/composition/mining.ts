import { MineProjectAction } from '@/actions/mine-project-action'
import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import type { MineProgressReporter } from '@/contracts/services/progress'
import type { MineProjectRequest, MineProjectResponse } from '@/models/mining'
import { HuggingFaceEmbeddingProvider } from '@/providers/embeddings/hugging-face-embedding-provider'
import { KonteksMineEngine } from '@/providers/extraction/mine-project'
import { loadProjectContext } from '@/providers/project/context'

export function createMiningAction(options: {
    embeddingProvider?: EmbeddingProviderContract
    onProgress?: MineProgressReporter
}): {
    execute(request: MineProjectRequest): Promise<MineProjectResponse>
} {
    const embeddingProvider =
        options.embeddingProvider ??
        new HuggingFaceEmbeddingProvider({
            onProgress: options.onProgress,
        })
    const mineEngine = new KonteksMineEngine({
        embeddingProvider,
        onProgress: options.onProgress,
    })
    const action = new MineProjectAction(mineEngine)

    return {
        async execute(request) {
            const project = await loadProjectContext(request.projectRoot)
            return action.execute(project, request)
        },
    }
}

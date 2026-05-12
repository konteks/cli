import { MineProjectAction } from '@/app/actions/mine-project-action'
import type { EmbeddingProviderContract } from '@/app/contracts/services/embedding-provider'
import type { MineProgressReporter } from '@/app/contracts/services/progress'
import { HuggingFaceEmbeddingProvider } from '@/app/providers/embeddings/hugging-face-embedding-provider'
import { KonteksMineEngine } from '@/app/providers/extraction/mine-project'
import { loadProjectContext } from '@/app/providers/project/context'
import type { MineProjectRequest, MineProjectResponse } from '@/models/mining'

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

import { ExtractProjectAction } from '@/actions/extract-project-action'
import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/models/extraction'
import { HuggingFaceEmbeddingProvider } from '@/providers/embeddings/hugging-face-embedding-provider'
import { KonteksExtractionEngine } from '@/providers/extraction/extract-project'
import { loadProjectContext } from '@/providers/project/context'

export function createExtractionAction(options: {
    embeddingProvider?: EmbeddingProviderContract
    onProgress?: ExtractionProgressReporter
}): {
    execute(request: ExtractProjectRequest): Promise<ExtractProjectResponse>
} {
    const embeddingProvider =
        options.embeddingProvider ??
        new HuggingFaceEmbeddingProvider({
            onProgress: options.onProgress,
        })
    const extractionEngine = new KonteksExtractionEngine({
        embeddingProvider,
        onProgress: options.onProgress,
    })
    const action = new ExtractProjectAction(extractionEngine)

    return {
        async execute(request) {
            const project = await loadProjectContext(request.projectRoot)
            return action.execute(project, request)
        },
    }
}

import type { EmbeddingProviderContract } from '@/contracts/services/embedding-provider'
import type { ExtractionEngineContract } from '@/contracts/services/extraction-engine'
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/models/extraction'
import HuggingFaceEmbeddingProvider from '@/providers/embeddings/hugging-face-embedding-provider'
import { KonteksExtractionEngine } from '@/providers/extraction/extract-project'
import { loadProjectContext } from '@/providers/project/context'

export type ProjectExtractor = {
    execute(request: ExtractProjectRequest): Promise<ExtractProjectResponse>
}

export type CreateProjectExtractorOptions = {
    embeddingProvider?: EmbeddingProviderContract
    extractionEngine?: ExtractionEngineContract
    onProgress?: ExtractionProgressReporter
}

export default function createProjectExtractor(
    options: CreateProjectExtractorOptions = {},
): ProjectExtractor {
    const extractionEngine =
        options.extractionEngine ?? createDefaultExtractionEngine(options)

    return {
        async execute(request) {
            const project = await loadProjectContext()
            return await extractionEngine.extract(project, request)
        },
    }
}

function createDefaultExtractionEngine(
    options: CreateProjectExtractorOptions,
): ExtractionEngineContract {
    const embeddingProvider =
        options.embeddingProvider ??
        new HuggingFaceEmbeddingProvider({
            onProgress: options.onProgress,
        })

    return new KonteksExtractionEngine({
        embeddingProvider,
        onProgress: options.onProgress,
    })
}

import type { ExtractionEngineContract } from '@/contracts/services/extraction-engine'
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/models/extraction'
import type { Project } from '@/models/project'
import HuggingFaceEmbeddingProvider from '@/providers/embeddings/hugging-face-embedding-provider'
import { KonteksExtractionEngine } from '@/providers/extraction/extract-project'
import { loadProjectContext } from '@/providers/project/context'

export type ProjectExtractor = {
    execute(request: ExtractProjectRequest): Promise<ExtractProjectResponse>
}

export type CreateProjectExtractorOptions = {
    extractionEngine?: ExtractionEngineContract
    onProgress?: ExtractionProgressReporter
    projectLoader?: () => Promise<Project>
}

export default function createProjectExtractor(
    options: CreateProjectExtractorOptions = {},
): ProjectExtractor {
    const extractionEngine =
        options.extractionEngine ?? createDefaultExtractionEngine(options)
    const projectLoader = options.projectLoader ?? loadProjectContext

    return {
        async execute(request) {
            const project = await projectLoader()
            return await extractionEngine.extract(project, request)
        },
    }
}

function createDefaultExtractionEngine(
    options: CreateProjectExtractorOptions,
): ExtractionEngineContract {
    const embeddingProvider = new HuggingFaceEmbeddingProvider({
        onProgress: options.onProgress,
    })

    return new KonteksExtractionEngine({
        embeddingProvider,
        onProgress: options.onProgress,
    })
}

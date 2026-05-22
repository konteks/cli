import HuggingFaceEmbeddingProvider from '@/modules/embeddings/hugging-face-embedding-provider'
import { KonteksExtractionEngine } from '@/modules/extraction/extract-project'
import { loadProjectContext } from '@/modules/project/context'
import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/types/extraction'
import type { ExtractionEngineContract } from '@/types/extraction-engine'
import type { ExtractionProgressReporter } from '@/types/progress'
import type { Project } from '@/types/project'

export type ProjectExtractor = {
    execute(request: ExtractProjectRequest): Promise<ExtractProjectResponse>
}

export type CreateProjectExtractorOptions = {
    extractionEngine?: ExtractionEngineContract
    onProgress?: ExtractionProgressReporter
    prepareEmbeddingBeforeExtraction?: boolean
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
        prepareEmbeddingBeforeExtraction:
            options.prepareEmbeddingBeforeExtraction,
    })
}

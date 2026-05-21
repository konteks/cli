import type { EmbeddingProviderContract as EmbeddingProvider } from '@/contracts/services/embedding-provider'
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import { withTransaction } from '@/database/actions/_db'
import countExtractedSections from '@/database/actions/count-extracted-sections'
import readExtractedProjectPathsAction from '@/database/actions/read-extracted-project-paths'
import type { Project } from '@/models/project'
import generateTargetEmbeddings from '@/providers/embeddings/generate-target-embeddings'
import type { ProjectMetadata } from '@/providers/extraction/engine/extract-project-metadata'
import extractSections from '@/providers/extraction/engine/extract-sections'
import type { ScannedFile } from '@/providers/extraction/engine/file-scan'
import type { ExtractionMode } from '@/providers/extraction/engine/manifest'

type ExtractProjectSectionsOptions = {
    beforeExtract?: () => Promise<void>
    deletedPaths: string[]
    embeddingProvider?: EmbeddingProvider
    extractedAt: string
    files: ScannedFile[]
    metadata: ProjectMetadata
    mode: ExtractionMode
    onProgress?: ExtractionProgressReporter
    project: Project
    totalFileCount: number
}

type ExtractProjectSectionsResult = {
    embeddedCount: number
    embeddingReusedCount: number
    extractedSections: Awaited<ReturnType<typeof extractSections>>
    totalSectionCount: number
}

export async function readExtractedProjectPaths(): Promise<Set<string>> {
    return await withTransaction(() => readExtractedProjectPathsAction())
}

export async function extractProjectSectionsWithDatabase(
    options: ExtractProjectSectionsOptions,
): Promise<ExtractProjectSectionsResult> {
    const extractedSections = await extractSections(
        options.project,
        options.files,
        options.extractedAt,
        {
            beforeExtract: options.beforeExtract,
            deletedPaths: options.deletedPaths,
            metadata: options.metadata,
            mode: options.mode,
            onProgress: options.onProgress,
        },
    )
    const totalSectionCount = await withTransaction(() =>
        countExtractedSections(),
    )
    if (options.mode === 'resume') {
        options.onProgress?.({
            chunkCount: totalSectionCount,
            current: options.totalFileCount,
            message: `Resumed extraction from ${options.totalFileCount} files`,
            phase: 'chunks',
            status: 'done',
            total: options.totalFileCount,
        })
    }
    const embeddingRun = options.embeddingProvider
        ? await generateTargetEmbeddings(
              options.embeddingProvider,
              ['chunk', 'module'],
              options.extractedAt,
              { onProgress: options.onProgress },
          )
        : { embeddedCount: 0, reusedCount: 0 }

    return {
        embeddedCount: embeddingRun.embeddedCount,
        embeddingReusedCount: embeddingRun.reusedCount,
        extractedSections,
        totalSectionCount,
    }
}

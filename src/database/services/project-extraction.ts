import { withTransaction } from '@/database/actions/_db'
import countExtractedSections from '@/database/actions/count-extracted-sections'
import readExtractedProjectPathsAction from '@/database/actions/read-extracted-project-paths'
import generateTargetEmbeddings from '@/modules/embeddings/generate-target-embeddings'
import type { ProjectMetadata } from '@/modules/extraction/engine/extract-project-metadata'
import extractSections from '@/modules/extraction/engine/extract-sections'
import type { ScannedFile } from '@/modules/extraction/engine/file-scan'
import type { ExtractionMode } from '@/modules/extraction/engine/manifest'
import type { EmbeddingProviderContract as EmbeddingProvider } from '@/types/embedding-provider'
import type { ExtractionProgressReporter } from '@/types/progress'
import type { Project } from '@/types/project'

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
            canUpdateEmbeddings: Boolean(options.embeddingProvider),
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
            current: options.totalFileCount,
            message: `Resumed extraction from ${options.totalFileCount} files`,
            phase: 'sections',
            sectionCount: totalSectionCount,
            status: 'done',
            total: options.totalFileCount,
        })
    }
    const embeddingRun = options.embeddingProvider
        ? await generateTargetEmbeddings(
              options.embeddingProvider,
              ['section', 'module', 'memory', 'diary'],
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

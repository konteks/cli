import { count, eq } from 'drizzle-orm'
import type { EmbeddingProviderContract as EmbeddingProvider } from '@/contracts/services/embedding-provider'
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import { openProjectDatabase } from '@/database/actions/_db'
import { chunks, sources } from '@/database/schema'
import type { Project } from '@/models/project'
import generateTargetEmbeddings from '@/providers/embeddings/generate-target-embeddings'
import type { ProjectMetadata } from '@/providers/extraction/engine/extract-project-metadata'
import extractSections from '@/providers/extraction/engine/extract-sections'
import type { ScannedFile } from '@/providers/extraction/engine/file-scan'
import type { ExtractionMode } from '@/providers/extraction/engine/manifest'
import { EXTRACTED_FILE_SOURCE_TYPE } from '@/providers/extraction/engine/source-types'

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

export async function readExtractedProjectPaths(
    context: Project,
): Promise<Set<string>> {
    const connection = await openProjectDatabase(context)
    try {
        const rows = await connection.db
            .selectDistinct({ path: sources.uri })
            .from(sources)
            .innerJoin(chunks, eq(chunks.sourceId, sources.id))
            .where(eq(sources.type, EXTRACTED_FILE_SOURCE_TYPE))

        return new Set(rows.flatMap(row => (row.path ? [row.path] : [])))
    } finally {
        await connection.close()
    }
}

export async function extractProjectSectionsWithDatabase(
    options: ExtractProjectSectionsOptions,
): Promise<ExtractProjectSectionsResult> {
    const connection = await openProjectDatabase(options.project)
    try {
        const extractedSections = await extractSections(
            connection,
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
        const totalSectionCount = await readTotalSectionCount(connection)
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
                  connection,
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
    } finally {
        await connection.close()
    }
}

async function readTotalSectionCount(
    connection: Awaited<ReturnType<typeof openProjectDatabase>>,
): Promise<number> {
    const rows = await connection.db.select({ count: count() }).from(chunks)
    return rows[0]?.count ?? 0
}

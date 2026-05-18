import { mkdir } from 'node:fs/promises'
import type { EmbeddingProviderContract as EmbeddingProvider } from '@/contracts/services/embedding-provider'
import type { ExtractionEngineContract } from '@/contracts/services/extraction-engine'
import type { ExtractionProgressReporter } from '@/contracts/services/progress'
import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/models/extraction'
import type { Project } from '@/models/project'
import generateTargetEmbeddings from '@/providers/embeddings/generate-target-embeddings'
import extractProjectMetadata from '@/providers/extraction/engine/extract-project-metadata'
import extractSections from '@/providers/extraction/engine/extract-sections'
import type { ScannedFile } from '@/providers/extraction/engine/file-scan'
import { scanProjectFilesWithDiagnostics } from '@/providers/extraction/engine/file-scan'
import formatProjectSummaryToon from '@/providers/extraction/engine/format-project-summary-toon'
import {
    getGrammarForPath,
    isBundledGrammar,
} from '@/providers/extraction/engine/grammar-loader'
import type {
    ExtractionManifest,
    ExtractionMode,
} from '@/providers/extraction/engine/manifest'
import {
    readExtractionManifest,
    writeExtractionManifest,
} from '@/providers/extraction/engine/manifest'
import { EXTRACTED_FILE_SOURCE_TYPE } from '@/providers/extraction/engine/source-types'
import createToonStore from '@/providers/persistence/objects/create-toon-store'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import type DatabaseService from '@/providers/persistence/sqlite/database-service'

export async function extractProject(
    project: Project,
    mode: ExtractionMode,
    options: {
        embeddingProvider?: EmbeddingProvider
        onProgress?: ExtractionProgressReporter
    } = {},
): Promise<ExtractProjectResponse> {
    const engine = new KonteksExtractionEngine(options)
    return await engine.extract(project, {
        mode,
        projectRoot: project.projectRoot,
    })
}

export class KonteksExtractionEngine implements ExtractionEngineContract {
    public constructor(
        private readonly options: {
            embeddingProvider?: EmbeddingProvider
            onProgress?: ExtractionProgressReporter
        } = {},
    ) {}

    public async extract(
        project: Project,
        request: ExtractProjectRequest,
    ): Promise<ExtractProjectResponse> {
        const { mode } = request
        const context = project
        const options = this.options
        const progress = options.onProgress
        progress?.({
            message: `Extracting ${context.projectRoot}`,
            phase: 'start',
            status: 'start',
        })
        await mkdir(context.memoryDir, { recursive: true })

        progress?.({
            message: 'Scanning project files',
            phase: 'scan',
            status: 'start',
        })
        const scan = await scanProjectFilesWithDiagnostics(context.projectRoot)
        const files = scan.files
        const detectedParserLanguages = detectParserLanguages(files)
        const languageCount = detectedParserLanguages.length
        progress?.({
            detectedParserLanguages,
            languageCount,
            message: `Scanned ${files.length} files`,
            phase: 'scan',
            status: 'done',
            total: files.length,
        })
        const previousManifest =
            mode === 'changed'
                ? await readExtractionManifest(context.memoryDir)
                : undefined
        progress?.({
            message: 'Extracting project metadata',
            phase: 'metadata',
            status: 'start',
        })
        const metadata = await extractProjectMetadata(
            context.projectRoot,
            files,
        )
        progress?.({
            message: `Detected ${metadata.technologies.length} technologies`,
            phase: 'metadata',
            status: 'done',
        })
        const extractedAt = new Date().toISOString()
        progress?.({
            message: 'Opening local memory database',
            phase: 'database',
            status: 'start',
        })
        const db = await openProjectDatabase(context)
        progress?.({
            message: 'Local memory database ready',
            phase: 'database',
            status: 'done',
        })
        const alreadyExtractedPaths =
            mode === 'resume' ? await readExtractedPaths(db) : undefined
        const { deletedPaths, filesToExtract } = selectFilesForMode(
            files,
            previousManifest,
            mode,
            alreadyExtractedPaths,
        )
        progress?.({
            message: `Selected ${filesToExtract.length} files to extract`,
            phase: 'select',
            status: 'done',
            total: filesToExtract.length,
        })
        const extractedSections = await extractSections(
            db,
            context,
            filesToExtract,
            extractedAt,
            {
                deletedPaths,
                metadata,
                mode,
                onProgress: progress,
            },
        )
        const embeddingRun = options.embeddingProvider
            ? await generateTargetEmbeddings(
                  db,
                  options.embeddingProvider,
                  ['chunk', 'module'],
                  extractedAt,
                  { onProgress: progress },
              )
            : { embeddedCount: 0, reusedCount: 0 }
        const vectorCount =
            embeddingRun.embeddedCount + embeddingRun.reusedCount
        const totalSectionCount = await readTotalSectionCount(db)
        await db.close()
        const toonStore = createToonStore(context.memoryDir)
        progress?.({
            message: 'Writing project summary',
            phase: 'summary',
            status: 'start',
        })
        const summary = await toonStore.write(
            formatProjectSummaryToon({
                fileCount: files.length,
                files,
                metadata,
                minedAt: extractedAt,
                mode,
                projectRoot: context.projectRoot,
            }),
        )
        progress?.({
            message: 'Project summary written',
            phase: 'summary',
            status: 'done',
        })

        const manifest: ExtractionManifest = {
            diagnostics: {
                ...scan.diagnostics,
                chunkCount: totalSectionCount,
                detectedParserLanguages,
                embeddedCount: embeddingRun.embeddedCount,
                embeddingReusedCount: embeddingRun.reusedCount,
                filesTruncatedByChunkLimit:
                    extractedSections.filesTruncatedByChunkLimit,
                languageCount,
                loadedParserCount: extractedSections.loadedParserCount,
                parserFallbackFiles: extractedSections.parserFallbackFiles,
                parserUsedFiles: extractedSections.parserUsedFiles,
                vectorCount,
            },
            fileCount: files.length,
            files,
            metadata,
            minedAt: extractedAt,
            mode,
            summaryHash: summary.hash,
            summaryRef: summary.ref,
            version: 1,
        }
        progress?.({
            message: 'Writing extraction manifest',
            phase: 'manifest',
            status: 'start',
        })
        await writeExtractionManifest(context.memoryDir, manifest)
        progress?.({
            chunkCount: extractedSections.chunkCount,
            embeddedCount: embeddingRun.embeddedCount,
            message: `Extraction complete: ${totalSectionCount} sections, ${vectorCount} indexed, ${embeddingRun.reusedCount} unchanged`,
            phase: 'done',
            reusedCount: embeddingRun.reusedCount,
            status: 'done',
        })

        return {
            chunkCount: totalSectionCount,
            deletedFilePaths: deletedPaths,
            detectedParserLanguages,
            embeddedCount: embeddingRun.embeddedCount,
            embeddingReusedCount: embeddingRun.reusedCount,
            extractedAt,
            fileCount: files.length,
            languageCount,
            loadedParserCount: extractedSections.loadedParserCount,
            mode,
            ok: true,
            projectRoot: context.projectRoot,
            summaryRef: summary.ref,
            technologies: metadata.technologies,
            updatedFilePaths: filesToExtract.map(file => file.path),
            vectorCount,
        }
    }
}

function detectParserLanguages(files: ScannedFile[]): string[] {
    return [
        ...new Set(
            files.flatMap(file => {
                const grammar = getGrammarForPath(file.path)
                return grammar && !isBundledGrammar(grammar.id)
                    ? [grammar.id]
                    : []
            }),
        ),
    ].sort((left, right) => left.localeCompare(right))
}

function selectFilesForMode(
    currentFiles: ScannedFile[],
    previousManifest: ExtractionManifest | undefined,
    mode: ExtractionMode,
    alreadyExtractedPaths?: Set<string>,
): { deletedPaths: string[]; filesToExtract: ScannedFile[] } {
    if (mode === 'reindex') {
        return { deletedPaths: [], filesToExtract: currentFiles }
    }

    if (mode === 'resume') {
        return {
            deletedPaths: [],
            filesToExtract: currentFiles.filter(
                file => !alreadyExtractedPaths?.has(file.path),
            ),
        }
    }

    if (mode !== 'changed' || !previousManifest) {
        return { deletedPaths: [], filesToExtract: currentFiles }
    }

    const previousByPath = new Map(
        previousManifest.files.map(file => [file.path, file]),
    )
    const currentByPath = new Map(currentFiles.map(file => [file.path, file]))

    const filesToExtract = currentFiles.filter(file => {
        const previous = previousByPath.get(file.path)
        if (!previous) {
            return true
        }
        return hasFileChanged(previous, file)
    })

    const deletedPaths = previousManifest.files
        .filter(file => !currentByPath.has(file.path))
        .map(file => file.path)

    return { deletedPaths, filesToExtract }
}

async function readExtractedPaths(db: DatabaseService): Promise<Set<string>> {
    const rows = await db.adapter.query<{ path: string }>(
        `
select distinct sources.uri as path
from sources
inner join chunks on chunks.source_id = sources.id
where sources.type = ?
  and sources.uri is not null
`,
        [EXTRACTED_FILE_SOURCE_TYPE],
    )

    return new Set(rows.map(row => row.path))
}

async function readTotalSectionCount(db: DatabaseService): Promise<number> {
    // Compatibility: extracted sections are persisted in the legacy `chunks` table.
    const rows = await db.adapter.query<{ count: number }>(
        'select count(*) as count from chunks',
    )

    return rows[0]?.count ?? 0
}

function hasFileChanged(previous: ScannedFile, current: ScannedFile): boolean {
    if (previous.contentHash && current.contentHash) {
        return previous.contentHash !== current.contentHash
    }

    return (
        previous.sizeBytes !== current.sizeBytes ||
        previous.mtimeMs !== current.mtimeMs
    )
}

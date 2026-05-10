import { mkdir } from 'node:fs/promises'
import type {
    MineProjectRequest,
    MineProjectResponse,
} from '../../application/dto/mine-project.js'
import type { IEmbeddingProvider as EmbeddingProvider } from '../../application/interfaces/embedding-provider.js'
import type { IMineEngine } from '../../application/interfaces/mine-engine.js'
import type { Project } from '../../domain/entities/project.js'
import { generateTargetEmbeddings } from '../ai/embedding-pipeline.js'
import { openProjectDatabase } from '../persistence/sqlite/database.js'
import type { DatabaseService } from '../persistence/sqlite/db.js'
import { createToonStore } from '../storage/toon-store.js'
import { mineChunks } from './chunk-store.js'
import type { ScannedFile } from './file-scan.js'
import { scanProjectFilesWithDiagnostics } from './file-scan.js'
import type { MineManifest, MineMode } from './manifest.js'
import { readMineManifest, writeMineManifest } from './manifest.js'
import { extractProjectMetadata } from './metadata.js'
import type { MineProgressReporter } from './progress.js'
import { formatProjectSummaryToon } from './toon-summary.js'
import type { TreeSitterEngine } from './tree-sitter-engine.js'

export async function mineProject(
    project: Project,
    mode: MineMode,
    options: {
        embeddingProvider?: EmbeddingProvider
        onProgress?: MineProgressReporter
        treeSitterEngine?: TreeSitterEngine
    } = {},
): Promise<MineProjectResponse> {
    const engine = new KonteksMineEngine(options)
    return await engine.mine(project, {
        mode,
        projectRoot: project.projectRoot,
    })
}

export class KonteksMineEngine implements IMineEngine {
    constructor(
        private readonly options: {
            embeddingProvider?: EmbeddingProvider
            onProgress?: MineProgressReporter
            treeSitterEngine?: TreeSitterEngine
        } = {},
    ) {}

    async mine(
        project: Project,
        request: MineProjectRequest,
    ): Promise<MineProjectResponse> {
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
        progress?.({
            message: `Scanned ${files.length} files`,
            phase: 'scan',
            status: 'done',
            total: files.length,
        })
        const previousManifest =
            mode === 'changed'
                ? await readMineManifest(context.memoryDir)
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
        const minedAt = new Date().toISOString()
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
        const { deletedPaths, filesToMine } = selectFilesForMode(
            files,
            previousManifest,
            mode,
            alreadyExtractedPaths,
        )
        progress?.({
            message: `Selected ${filesToMine.length} files to extract`,
            phase: 'select',
            status: 'done',
            total: filesToMine.length,
        })
        const minedChunks = await mineChunks(
            db,
            context,
            filesToMine,
            minedAt,
            {
                deletedPaths,
                metadata,
                mode,
                onProgress: progress,
                treeSitterEngine: options.treeSitterEngine,
            },
        )
        const embeddingRun = options.embeddingProvider
            ? await generateTargetEmbeddings(
                  db,
                  options.embeddingProvider,
                  ['chunk', 'module'],
                  minedAt,
                  { onProgress: progress },
              )
            : { embeddedCount: 0, reusedCount: 0 }
        const totalChunkCount = await readTotalChunkCount(db)
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
                minedAt,
                mode,
                projectRoot: context.projectRoot,
            }),
        )
        progress?.({
            message: 'Project summary written',
            phase: 'summary',
            status: 'done',
        })

        const manifest: MineManifest = {
            diagnostics: {
                ...scan.diagnostics,
                chunkCount: totalChunkCount,
                embeddedCount: embeddingRun.embeddedCount,
                embeddingReusedCount: embeddingRun.reusedCount,
                filesTruncatedByChunkLimit:
                    minedChunks.filesTruncatedByChunkLimit,
                parserFallbackFiles: minedChunks.parserFallbackFiles,
                parserUsedFiles: minedChunks.parserUsedFiles,
            },
            fileCount: files.length,
            files,
            metadata,
            minedAt,
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
        await writeMineManifest(context.memoryDir, manifest)
        progress?.({
            chunkCount: minedChunks.chunkCount,
            embeddedCount: embeddingRun.embeddedCount,
            message: `Extraction complete: ${totalChunkCount} sections, ${embeddingRun.embeddedCount} indexed, ${embeddingRun.reusedCount} unchanged`,
            phase: 'done',
            reusedCount: embeddingRun.reusedCount,
            status: 'done',
        })

        return {
            chunkCount: totalChunkCount,
            deletedFilePaths: deletedPaths,
            embeddedCount: embeddingRun.embeddedCount,
            embeddingReusedCount: embeddingRun.reusedCount,
            fileCount: files.length,
            minedAt,
            mode,
            ok: true,
            projectRoot: context.projectRoot,
            summaryRef: summary.ref,
            technologies: metadata.technologies,
            updatedFilePaths: filesToMine.map(file => file.path),
        }
    }
}

function selectFilesForMode(
    currentFiles: ScannedFile[],
    previousManifest: MineManifest | undefined,
    mode: MineMode,
    alreadyExtractedPaths?: Set<string>,
): { deletedPaths: string[]; filesToMine: ScannedFile[] } {
    if (mode === 'reindex') {
        return { deletedPaths: [], filesToMine: currentFiles }
    }

    if (mode === 'resume') {
        return {
            deletedPaths: [],
            filesToMine: currentFiles.filter(
                file => !alreadyExtractedPaths?.has(file.path),
            ),
        }
    }

    if (mode !== 'changed' || !previousManifest) {
        return { deletedPaths: [], filesToMine: currentFiles }
    }

    const previousByPath = new Map(
        previousManifest.files.map(file => [file.path, file]),
    )
    const currentByPath = new Map(currentFiles.map(file => [file.path, file]))

    const filesToMine = currentFiles.filter(file => {
        const previous = previousByPath.get(file.path)
        if (!previous) {
            return true
        }
        return hasFileChanged(previous, file)
    })

    const deletedPaths = previousManifest.files
        .filter(file => !currentByPath.has(file.path))
        .map(file => file.path)

    return { deletedPaths, filesToMine }
}

async function readExtractedPaths(db: DatabaseService): Promise<Set<string>> {
    const rows = await db.adapter.query<{ path: string }>(
        `
select distinct sources.uri as path
from sources
inner join chunks on chunks.source_id = sources.id
where sources.type = 'mined_file'
  and sources.uri is not null
`,
    )

    return new Set(rows.map(row => row.path))
}

async function readTotalChunkCount(db: DatabaseService): Promise<number> {
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

import { mkdir } from 'node:fs/promises'
import type { LoadedProjectContext } from '../project/context.js'
import { openProjectDatabase } from '../storage/database.js'
import { createToonStore } from '../storage/toon-store.js'
import { mineChunks } from './chunk-store.js'
import { generateTargetEmbeddings } from './embedding-pipeline.js'
import type { EmbeddingProvider } from './embedding-provider.js'
import type { ScannedFile } from './file-scan.js'
import { scanProjectFilesWithDiagnostics } from './file-scan.js'
import type { MineManifest, MineMode } from './manifest.js'
import { readMineManifest, writeMineManifest } from './manifest.js'
import { extractProjectMetadata } from './metadata.js'
import { formatProjectSummaryToon } from './toon-summary.js'

type MineProjectResult = {
    ok: true
    mode: MineMode
    projectRoot: string
    fileCount: number
    minedAt: string
    summaryRef: string
    chunkCount: number
    embeddedCount: number
    embeddingReusedCount: number
    technologies: string[]
}

export async function mineProject(
    context: LoadedProjectContext,
    mode: MineMode,
    options: { embeddingProvider?: EmbeddingProvider } = {},
): Promise<MineProjectResult> {
    await mkdir(context.memoryDir, { recursive: true })

    const scan = await scanProjectFilesWithDiagnostics(context.projectRoot)
    const files = scan.files
    const previousManifest =
        mode === 'changed'
            ? await readMineManifest(context.memoryDir)
            : undefined
    const { deletedPaths, filesToMine } = selectFilesForMode(
        files,
        previousManifest,
        mode,
    )
    const metadata = await extractProjectMetadata(context.projectRoot, files)
    const minedAt = new Date().toISOString()
    const adapter = await openProjectDatabase(context)
    const minedChunks = await mineChunks(
        adapter,
        context,
        filesToMine,
        minedAt,
        {
            deletedPaths,
            mode,
        },
    )
    const embeddingRun = options.embeddingProvider
        ? await generateTargetEmbeddings(
              adapter,
              options.embeddingProvider,
              ['chunk', 'module'],
              minedAt,
          )
        : { embeddedCount: 0, reusedCount: 0 }
    await adapter.close()
    const toonStore = createToonStore(context.memoryDir)
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

    const manifest: MineManifest = {
        diagnostics: {
            ...scan.diagnostics,
            chunkCount: minedChunks.chunkCount,
            embeddedCount: embeddingRun.embeddedCount,
            embeddingReusedCount: embeddingRun.reusedCount,
            filesTruncatedByChunkLimit: minedChunks.filesTruncatedByChunkLimit,
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
    await writeMineManifest(context.memoryDir, manifest)

    return {
        chunkCount: minedChunks.chunkCount,
        embeddedCount: embeddingRun.embeddedCount,
        embeddingReusedCount: embeddingRun.reusedCount,
        fileCount: files.length,
        minedAt,
        mode,
        ok: true,
        projectRoot: context.projectRoot,
        summaryRef: summary.ref,
        technologies: metadata.technologies,
    }
}

function selectFilesForMode(
    currentFiles: ScannedFile[],
    previousManifest: MineManifest | undefined,
    mode: MineMode,
): { deletedPaths: string[]; filesToMine: ScannedFile[] } {
    if (mode === 'reindex') {
        return { deletedPaths: [], filesToMine: currentFiles }
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

function hasFileChanged(previous: ScannedFile, current: ScannedFile): boolean {
    if (previous.contentHash && current.contentHash) {
        return previous.contentHash !== current.contentHash
    }

    return (
        previous.sizeBytes !== current.sizeBytes ||
        previous.mtimeMs !== current.mtimeMs
    )
}

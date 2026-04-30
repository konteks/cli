import { mkdir } from 'node:fs/promises'
import type { LoadedProjectContext } from '../project/context.js'
import { openProjectDatabase } from '../storage/database.js'
import { createToonStore } from '../storage/toon-store.js'
import { mineChunks } from './chunk-store.js'
import { scanProjectFilesWithDiagnostics } from './file-scan.js'
import type { MineManifest, MineMode } from './manifest.js'
import { writeMineManifest } from './manifest.js'
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
    technologies: string[]
}

export async function mineProject(
    context: LoadedProjectContext,
    mode: MineMode,
): Promise<MineProjectResult> {
    await mkdir(context.memoryDir, { recursive: true })

    const scan = await scanProjectFilesWithDiagnostics(context.projectRoot)
    const files = scan.files
    const metadata = await extractProjectMetadata(context.projectRoot, files)
    const minedAt = new Date().toISOString()
    const adapter = await openProjectDatabase(context)
    const minedChunks = await mineChunks(adapter, context, files, minedAt)
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
        fileCount: files.length,
        minedAt,
        mode,
        ok: true,
        projectRoot: context.projectRoot,
        summaryRef: summary.ref,
        technologies: metadata.technologies,
    }
}

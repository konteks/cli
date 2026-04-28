import { mkdir, writeFile } from 'node:fs/promises'
import type { LoadedProjectContext } from '../project/context.js'
import { createToonStore } from '../storage/toon-store.js'
import { scanProjectFiles } from './file-scan.js'
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
    technologies: string[]
}

export async function mineProject(
    context: LoadedProjectContext,
    mode: MineMode,
): Promise<MineProjectResult> {
    await mkdir(context.memoryDir, { recursive: true })
    if (!context.configExists) {
        await writeFile(
            context.configPath,
            `${JSON.stringify(context.config, null, 2)}\n`,
            { flag: 'wx' },
        )
    }

    const files = await scanProjectFiles(context.projectRoot)
    const metadata = await extractProjectMetadata(context.projectRoot, files)
    const minedAt = new Date().toISOString()
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
        fileCount: files.length,
        minedAt,
        mode,
        ok: true,
        projectRoot: context.projectRoot,
        summaryRef: summary.ref,
        technologies: metadata.technologies,
    }
}

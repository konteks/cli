import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LoadedProjectContext } from '../project/context.js'
import { pathExists } from '../project/context.js'
import { type ScannedFile, scanProjectFiles } from './file-scan.js'
import type { ProjectMetadata } from './metadata.js'

export type MineMode = 'changed' | 'full'

export type MineManifest = {
    version: 1
    minedAt: string
    mode: MineMode
    fileCount: number
    files: ScannedFile[]
    metadata: ProjectMetadata
    summaryRef: string
    summaryHash: string
}

type MiningFreshness = {
    status: 'missing' | 'fresh' | 'stale'
    reason: string
    recommendedCommand?: string
    lastMinedAt?: string
}

function mineManifestPath(memoryDir: string): string {
    return join(memoryDir, 'mine-manifest.json')
}

export async function readMineManifest(
    memoryDir: string,
): Promise<MineManifest | undefined> {
    const path = mineManifestPath(memoryDir)
    if (!(await pathExists(path))) {
        return undefined
    }

    return JSON.parse(await readFile(path, 'utf8')) as MineManifest
}

export async function writeMineManifest(
    memoryDir: string,
    manifest: MineManifest,
): Promise<void> {
    await writeFile(
        mineManifestPath(memoryDir),
        `${JSON.stringify(manifest, null, 2)}\n`,
    )
}

export async function getMiningFreshness(
    context: LoadedProjectContext,
): Promise<MiningFreshness> {
    const manifest = await readMineManifest(context.memoryDir)
    if (!manifest) {
        return {
            reason: 'No mining manifest exists yet.',
            recommendedCommand: 'konteks mine',
            status: 'missing',
        }
    }

    const currentFiles = await scanProjectFiles(context.projectRoot)
    const staleReason = findStaleReason(manifest.files, currentFiles)

    if (staleReason) {
        return {
            lastMinedAt: manifest.minedAt,
            reason: staleReason,
            recommendedCommand: 'konteks mine --changed',
            status: 'stale',
        }
    }

    return {
        lastMinedAt: manifest.minedAt,
        reason: `Project mining is current for ${manifest.fileCount} files.`,
        status: 'fresh',
    }
}

function findStaleReason(
    previousFiles: ScannedFile[],
    currentFiles: ScannedFile[],
): string | undefined {
    if (previousFiles.length !== currentFiles.length) {
        return 'Project file set changed since the last mine.'
    }

    const previousByPath = new Map(previousFiles.map(file => [file.path, file]))

    for (const current of currentFiles) {
        const previous = previousByPath.get(current.path)
        if (!previous) {
            return `New file detected: ${current.path}.`
        }
        if (
            previous.sizeBytes !== current.sizeBytes ||
            previous.mtimeMs !== current.mtimeMs
        ) {
            return `Changed file detected: ${current.path}.`
        }
    }

    return undefined
}

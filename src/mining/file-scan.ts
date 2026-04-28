import { readdir, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import {
    defaultMaxMineFileBytes,
    shouldIgnoreRelativePath,
} from './ignore-rules.js'

export type ScannedFile = {
    path: string
    sizeBytes: number
    mtimeMs: number
}

type ScanProjectOptions = {
    maxFileBytes?: number
}

export async function scanProjectFiles(
    projectRoot: string,
    options: ScanProjectOptions = {},
): Promise<ScannedFile[]> {
    const files: ScannedFile[] = []
    const maxFileBytes = options.maxFileBytes ?? defaultMaxMineFileBytes

    await scanDirectory(projectRoot, projectRoot, files, maxFileBytes)

    return files.sort((left, right) => compareText(left.path, right.path))
}

async function scanDirectory(
    projectRoot: string,
    directory: string,
    files: ScannedFile[],
    maxFileBytes: number,
): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })

    for (const entry of entries) {
        const absolutePath = join(directory, entry.name)
        const relativePath = toRelativeProjectPath(projectRoot, absolutePath)

        if (shouldIgnoreRelativePath(relativePath)) {
            continue
        }

        if (entry.isDirectory()) {
            await scanDirectory(projectRoot, absolutePath, files, maxFileBytes)
            continue
        }

        if (!entry.isFile()) {
            continue
        }

        const fileStat = await stat(absolutePath)
        if (fileStat.size > maxFileBytes) {
            continue
        }

        files.push({
            mtimeMs: Math.trunc(fileStat.mtimeMs),
            path: relativePath,
            sizeBytes: fileStat.size,
        })
    }
}

function toRelativeProjectPath(
    projectRoot: string,
    absolutePath: string,
): string {
    return relative(projectRoot, absolutePath).split(sep).join('/')
}

function compareText(left: string, right: string): number {
    if (left < right) {
        return -1
    }
    if (left > right) {
        return 1
    }
    return 0
}

import { afterEach } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

export function trackTempDir(path: string): string {
    tempDirs.push(path)
    return path
}

export async function makeTempProject(
    prefix = 'konteks-test-',
): Promise<string> {
    const projectRoot = trackTempDir(await mkdtemp(join(tmpdir(), prefix)))
    await writeFile(join(projectRoot, 'package.json'), '{"name":"fixture"}\n')
    return projectRoot
}

export async function createConfiguredProject(
    prefix = 'konteks-configured-',
): Promise<string> {
    const projectRoot = await makeTempProject(prefix)
    const memoryDir = join(projectRoot, '.konteks')

    await mkdir(memoryDir, { recursive: true })
    await writeFile(join(memoryDir, 'config.json'), '{}\n')

    return projectRoot
}

export async function withWorkingDirectory<T>(
    cwd: string,
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(cwd)

    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}

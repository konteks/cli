import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
} from '@/modules/memory/runtime'

import { mkdir, rm } from '@/support/file-manager'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(path => rm(path)))
})

async function withWorkingDirectory<T>(
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

describe('memory/runtime', () => {
    it('loads project context from the current project directory', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-runtime-'))
        tempDirs.push(projectRoot)
        await writeFile(
            join(projectRoot, 'package.json'),
            '{"name":"fixture"}\n',
        )
        await mkdir(join(projectRoot, '.konteks'))

        const context = await withWorkingDirectory(projectRoot, () =>
            loadMcpProjectContext(),
        )

        expect(context.projectRoot).toBe(projectRoot)
        expect(context.memoryDir).toBe(join(projectRoot, '.konteks'))
        expect(context.configPath).toBe(
            join(projectRoot, '.konteks', 'config.json'),
        )
        expect(context.configExists).toBe(false)
    })

    it('skips changed-project extraction when memory is not initialized', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-runtime-'))
        tempDirs.push(projectRoot)
        await writeFile(
            join(projectRoot, 'package.json'),
            '{"name":"fixture"}\n',
        )
        const context = await withWorkingDirectory(projectRoot, () =>
            loadMcpProjectContext(),
        )

        await expect(
            updateChangedProjectMemorySilently(context),
        ).resolves.toBeUndefined()
    })
})

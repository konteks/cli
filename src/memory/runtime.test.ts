import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    loadMcpProjectContext,
    updateChangedProjectMemorySilently,
} from './runtime'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('memory/runtime', () => {
    it('loads project context and applies an MCP memory directory override', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-runtime-'))
        tempDirs.push(projectRoot)
        const memoryDir = join(projectRoot, 'custom-memory')
        await mkdir(memoryDir, { recursive: true })

        const context = await loadMcpProjectContext({
            memoryDir,
            project: projectRoot,
        })

        expect(context.projectRoot).toBe(projectRoot)
        expect(context.memoryDir).toBe(memoryDir)
        expect(context.configPath).toBe(join(memoryDir, 'config.json'))
        expect(context.configExists).toBe(false)
    })

    it('skips changed-project extraction when memory is not initialized', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-runtime-'))
        tempDirs.push(projectRoot)
        const context = await loadMcpProjectContext({ project: projectRoot })

        await expect(
            updateChangedProjectMemorySilently(context),
        ).resolves.toBeUndefined()
    })
})

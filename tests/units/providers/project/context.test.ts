import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    createDefaultConfig,
    loadProjectContext,
    resolveProjectContext,
} from '@/providers/project/context'
import ProjectStatusReader from '@/providers/project/project-status-reader'

const tempDirs: string[] = []

async function makeTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-test-'))
    tempDirs.push(projectRoot)
    await writeFile(join(projectRoot, 'package.json'), '{"name":"fixture"}\n')
    return projectRoot
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
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

describe('project context', () => {
    it('resolves the project root from the current working directory', async () => {
        const projectRoot = await makeTempProject()

        const context = await withWorkingDirectory(projectRoot, () =>
            resolveProjectContext(),
        )

        expect(context.projectRoot).toBe(projectRoot)
        expect(context.memoryDir).toBe(join(projectRoot, '.konteks'))
        expect(context.configPath).toBe(
            join(projectRoot, '.konteks', 'config.json'),
        )
    })

    it('creates default config for the project-local memory directory', () => {
        expect(createDefaultConfig()).toEqual({
            extraction: {
                grammars: {
                    selected: [],
                    updateTtlHours: 24,
                },
            },
            recall: {
                maxTokens: 2000,
            },
            storage: {
                inlinePayloadMaxBytes: 2048,
            },
        })
    })

    it('reports missing memory when the project is not initialized', async () => {
        const projectRoot = await makeTempProject()
        const reader = new ProjectStatusReader()

        const status = await withWorkingDirectory(projectRoot, () =>
            loadProjectContext().then(context => reader.read(context)),
        )

        expect(status.freshness).toEqual({
            changedFileCount: 0,
            reason: 'Konteks project memory is not initialized.',
            recommendedCommand: 'konteks init',
            status: 'missing',
        })
    })

    it('reports missing extraction metadata when config exists', async () => {
        const projectRoot = await makeTempProject()
        await mkdir(join(projectRoot, '.konteks'), { recursive: true })
        await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
        const reader = new ProjectStatusReader()

        const status = await withWorkingDirectory(projectRoot, () =>
            loadProjectContext().then(context => reader.read(context)),
        )

        expect(status.freshness.status).toBe('missing')
        expect(status.freshness.recommendedCommand).toBe('konteks repair')
    })
})

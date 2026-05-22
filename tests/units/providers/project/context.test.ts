import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import StatusCommand from '@/entrypoints/cli/commands/status-command'
import {
    createDefaultConfig,
    resolveProjectContext,
} from '@/modules/project/context'
import { terminal } from '@/support/terminal/service'

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
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})
        const colorSpy = spyOn(terminal, 'stdoutSupportsColor').mockReturnValue(
            false,
        )

        try {
            await withWorkingDirectory(projectRoot, () =>
                new StatusCommand().handle(),
            )
            const output = logSpy.mock.calls[0]?.[0] ?? ''
            expect(output).toContain('Project memory status')
            expect(output).toContain('Status        Not initialized')
            expect(output).toContain('Last indexed  Not indexed yet')
            expect(output).toContain(
                'Documents       0 (0 sections, 0 modules)',
            )
        } finally {
            colorSpy.mockRestore()
            logSpy.mockRestore()
        }
    })

    it('reports missing extraction metadata when config exists', async () => {
        const projectRoot = await makeTempProject()
        await mkdir(join(projectRoot, '.konteks'), { recursive: true })
        await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})
        const colorSpy = spyOn(terminal, 'stdoutSupportsColor').mockReturnValue(
            false,
        )

        try {
            await withWorkingDirectory(projectRoot, () =>
                new StatusCommand().handle(),
            )
            const output = logSpy.mock.calls[0]?.[0] ?? ''
            expect(output).toContain('Project memory status')
            expect(output).toContain('Status        Not initialized')
            expect(output).toContain('Last indexed  Not indexed yet')
            expect(output).toContain(
                'Documents       0 (0 sections, 0 modules)',
            )
        } finally {
            colorSpy.mockRestore()
            logSpy.mockRestore()
        }
    })
})

import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import StatusCommand from '@/entrypoints/cli/commands/status-command'
import {
    createDefaultConfig,
    resolveProjectContext,
} from '@/modules/project/context'
import consoleOutput, {
    type ConsoleColorPalette,
    type ConsoleOutputMessage,
} from '@/support/console-output'

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
        })
    })

    it('reports missing memory when the project is not initialized', async () => {
        const projectRoot = await makeTempProject()
        const output: string[] = []
        const logSpy = spyOn(consoleOutput, 'print').mockImplementation(
            message => {
                output.push(renderStdoutMessage(message))
                return consoleOutput
            },
        )

        try {
            await withWorkingDirectory(projectRoot, () =>
                new StatusCommand().handle(),
            )
            const renderedOutput = stripAnsi(output.join('\n'))
            expect(renderedOutput).toContain('██████')
            expect(renderedOutput).toContain('Konteks  v')
            expect(renderedOutput).toContain('Status        NOT INITIALIZED')
            expect(renderedOutput).toContain('Last indexed  Not indexed yet')
            expect(renderedOutput).toContain('Vectors       0')
            expect(renderedOutput).toContain('DERIVED MEMORY')
            expect(renderedOutput).toContain('Modules       0')
            expect(renderedOutput).toContain('Sections      0')
            expect(renderedOutput).toContain('DURABLE MEMORY')
        } finally {
            logSpy.mockRestore()
        }
    })

    it('reports missing extraction metadata when config exists', async () => {
        const projectRoot = await makeTempProject()
        await mkdir(join(projectRoot, '.konteks'), { recursive: true })
        await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')
        const output: string[] = []
        const logSpy = spyOn(consoleOutput, 'print').mockImplementation(
            message => {
                output.push(renderStdoutMessage(message))
                return consoleOutput
            },
        )

        try {
            await withWorkingDirectory(projectRoot, () =>
                new StatusCommand().handle(),
            )
            const renderedOutput = stripAnsi(output.join('\n'))
            expect(renderedOutput).toContain('██████')
            expect(renderedOutput).toContain('Konteks  v')
            expect(renderedOutput).toContain('Status        NOT INITIALIZED')
            expect(renderedOutput).toContain('Last indexed  Not indexed yet')
            expect(renderedOutput).toContain('Vectors       0')
            expect(renderedOutput).toContain('DERIVED MEMORY')
            expect(renderedOutput).toContain('Modules       0')
            expect(renderedOutput).toContain('Sections      0')
            expect(renderedOutput).toContain('DURABLE MEMORY')
        } finally {
            logSpy.mockRestore()
        }
    })
})

function renderStdoutMessage(message: ConsoleOutputMessage): string {
    return isOutputFormatter(message)
        ? consoleOutput.withStdoutColor(message)
        : String(message)
}

function isOutputFormatter(
    message: ConsoleOutputMessage,
): message is (color: ConsoleColorPalette) => string {
    return typeof message === 'function'
}

function stripAnsi(value: string): string {
    const ansiPattern = new RegExp(
        `${String.fromCharCode(27)}\\[[0-9;]*m`,
        'gu',
    )
    return value.replaceAll(ansiPattern, '')
}

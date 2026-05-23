import { describe, expect, it, spyOn } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import StatusCommand from '@/entrypoints/cli/commands/status-command'
import consoleOutput, {
    type ConsoleColorPalette,
    type ConsoleOutputMessage,
} from '@/support/console-output'

describe('project/status', () => {
    it('prints status with the current project paths', async () => {
        const projectRoot = await createConfiguredProject()
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
            expect(logSpy).toHaveBeenCalledTimes(2)
            const renderedOutput = stripAnsi(output.join('\n'))
            expect(renderedOutput).toContain('██████')
            expect(renderedOutput).toContain('Konteks  v')
            expect(renderedOutput).toContain(projectRoot)
            expect(renderedOutput).toContain(join(projectRoot, '.konteks'))
            expect(renderedOutput).toContain('Status        NOT INITIALIZED')
            expect(renderedOutput).toContain('Last indexed  Not indexed yet')
        } finally {
            logSpy.mockRestore()
        }
    })
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

async function createConfiguredProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-status-'))
    const memoryDir = join(projectRoot, '.konteks')
    await writeFile(join(projectRoot, 'package.json'), '{"type":"module"}\n')
    await mkdir(memoryDir, { recursive: true })
    await writeFile(join(memoryDir, 'config.json'), '{}\n')
    return projectRoot
}

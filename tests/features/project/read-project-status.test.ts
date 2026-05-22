import { describe, expect, it, spyOn } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import StatusCommand from '@/entrypoints/cli/commands/status-command'
import { terminal } from '@/support/terminal/service'

describe('project/status', () => {
    it('prints status with the current project paths', async () => {
        const projectRoot = await createConfiguredProject()
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})
        const colorSpy = spyOn(terminal, 'stdoutSupportsColor').mockReturnValue(
            false,
        )

        try {
            await withWorkingDirectory(projectRoot, () =>
                new StatusCommand().handle(),
            )
            expect(logSpy).toHaveBeenCalledTimes(1)
            const output = logSpy.mock.calls[0]?.[0] ?? ''
            expect(output).toContain(projectRoot)
            expect(output).toContain(join(projectRoot, '.konteks'))
            expect(output).toContain('Project memory status')
            expect(output).toContain('Status        Not initialized')
            expect(output).toContain('Last indexed  Not indexed yet')
        } finally {
            colorSpy.mockRestore()
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

async function createConfiguredProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-status-'))
    const memoryDir = join(projectRoot, '.konteks')
    await writeFile(join(projectRoot, 'package.json'), '{"type":"module"}\n')
    await mkdir(memoryDir, { recursive: true })
    await writeFile(join(memoryDir, 'config.json'), '{}\n')
    return projectRoot
}

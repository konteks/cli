import { describe, expect, it, spyOn } from 'bun:test'
import { join } from 'node:path'
import StatusCommand from '@/entrypoints/cli/commands/status-command'
import consoleOutput from '@/support/console-output'
import { renderStdoutMessage, stripAnsi } from '../../support/output'
import {
    createConfiguredProject,
    withWorkingDirectory,
} from '../../support/project'

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

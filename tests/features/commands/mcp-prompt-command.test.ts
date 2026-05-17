import { describe, expect, it, spyOn } from 'bun:test'
import PromptCommand from '@/commands/mcp/prompt-command'
import { terminal } from '@/support/terminal/service'

describe('commands/mcp/prompt', () => {
    it('renders prompts from blank, free-form, and JSON inputs', async () => {
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})

        try {
            await new PromptCommand().handle({
                args: ['konteks-recall', undefined],
                options: {},
            })
            await new PromptCommand().handle({
                args: ['konteks-warm-up', ['test coverage']],
                options: {},
            })
            await new PromptCommand().handle({
                args: ['konteks-recall', ['{"task":"continue tests"}']],
                options: {},
            })

            expect(logSpy).toHaveBeenCalledTimes(3)
            expect(logSpy.mock.calls[0]?.[0]).toContain('"description"')
            expect(logSpy.mock.calls[1]?.[0]).toContain('test coverage')
            expect(logSpy.mock.calls[2]?.[0]).toContain('continue tests')
        } finally {
            logSpy.mockRestore()
        }
    })

    it('rejects invalid prompt argument shapes', async () => {
        await expect(
            new PromptCommand().handle({
                args: ['konteks-recall', ['[]']],
                options: {},
            }),
        ).rejects.toThrow('Prompt arguments must be a JSON object.')
        await expect(
            new PromptCommand().handle({
                args: ['konteks-recall', ['{"task":123}']],
                options: {},
            }),
        ).rejects.toThrow('Prompt argument "task" must be a string.')
    })
})

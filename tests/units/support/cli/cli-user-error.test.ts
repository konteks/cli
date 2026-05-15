import { describe, expect, it } from 'bun:test'
import type { CliUserErrorOptions } from '@/support/cli/cli-user-error'
import CliUserError from '@/support/cli/cli-user-error'

describe('support/cli/errors', () => {
    it('copies user-facing error fields onto the Error instance', () => {
        const options = {
            command: 'konteks init',
            hint: 'Run from a project root.',
            message: 'Project is not initialized.',
            title: 'Missing memory',
        } satisfies CliUserErrorOptions

        const error = new CliUserError(options)

        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe('CliUserError')
        expect(error.message).toBe(options.message)
        expect(error.command).toBe(options.command)
        expect(error.hint).toBe(options.hint)
        expect(error.title).toBe(options.title)
    })
})

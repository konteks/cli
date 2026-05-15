import { describe, expect, it } from 'bun:test'
import printCliError from './print-cli-error'

describe('support/cli/error-output', () => {
    it('matches the public runtime contract', () => {
        const cases = [['printCliError', printCliError, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['printCliError'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})

import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import consoleOutput from '@/support/console-output'

const previousEnv = {
    FORCE_COLOR: process.env.FORCE_COLOR,
    NO_COLOR: process.env.NO_COLOR,
}

afterEach(() => {
    restoreEnv('FORCE_COLOR', previousEnv.FORCE_COLOR)
    restoreEnv('NO_COLOR', previousEnv.NO_COLOR)
})

describe('support/console-output', () => {
    it('prints plain callback output when colors are disabled', () => {
        process.env.NO_COLOR = '1'
        delete process.env.FORCE_COLOR
        const logSpy = spyOn(console, 'log').mockImplementation(() => {})

        try {
            const result = consoleOutput.print(color => color.accent('value'))

            expect(result).toBe(consoleOutput)
            expect(logSpy).toHaveBeenCalledWith('value')
        } finally {
            logSpy.mockRestore()
        }
    })

    it('prints colored callback output when colors are forced', () => {
        delete process.env.NO_COLOR
        process.env.FORCE_COLOR = '1'
        const logSpy = spyOn(console, 'log').mockImplementation(() => {})

        try {
            consoleOutput.print(color => color.success('ok'))

            expect(logSpy).toHaveBeenCalledWith('\u001b[32mok\u001b[0m')
        } finally {
            logSpy.mockRestore()
        }
    })

    it('exposes all palette helpers through callbacks', () => {
        let keys: string[] = []
        const logSpy = spyOn(console, 'log').mockImplementation(() => {})

        try {
            consoleOutput.print(color => {
                keys = Object.keys(color).sort()
                return 'done'
            })

            expect(keys).toEqual([
                'accent',
                'danger',
                'dim',
                'info',
                'success',
                'warning',
            ])
        } finally {
            logSpy.mockRestore()
        }
    })

    it('prints plain TOON text for strings when colors are disabled', () => {
        process.env.NO_COLOR = '1'
        delete process.env.FORCE_COLOR
        const logSpy = spyOn(console, 'log').mockImplementation(() => {})

        try {
            const result = consoleOutput.toon('plain text')

            expect(result).toBe(consoleOutput)
            expect(logSpy).toHaveBeenCalledWith('plain text')
        } finally {
            logSpy.mockRestore()
        }
    })

    it('prints encoded TOON objects when colors are disabled', () => {
        process.env.NO_COLOR = '1'
        delete process.env.FORCE_COLOR
        const logSpy = spyOn(console, 'log').mockImplementation(() => {})

        try {
            consoleOutput.toon({ count: 2, ok: true })

            expect(logSpy).toHaveBeenCalledWith('count: 2\nok: true')
        } finally {
            logSpy.mockRestore()
        }
    })

    it('highlights TOON output when colors are forced', () => {
        delete process.env.NO_COLOR
        process.env.FORCE_COLOR = '1'
        const logSpy = spyOn(console, 'log').mockImplementation(() => {})

        try {
            consoleOutput.toon({ ok: true })

            expect(logSpy).toHaveBeenCalledWith(
                '\u001b[36mok\u001b[0m\u001b[90m:\u001b[0m \u001b[32mtrue\u001b[0m',
            )
        } finally {
            logSpy.mockRestore()
        }
    })

    it('highlights TOON syntax instead of coloring the whole output', () => {
        delete process.env.NO_COLOR
        process.env.FORCE_COLOR = '1'
        const logSpy = spyOn(console, 'log').mockImplementation(() => {})

        try {
            consoleOutput.toon({ count: 2, label: 'ready' })

            expect(logSpy).toHaveBeenCalledWith(
                [
                    '\u001b[36mcount\u001b[0m\u001b[90m:\u001b[0m \u001b[34m2\u001b[0m',
                    '\u001b[36mlabel\u001b[0m\u001b[90m:\u001b[0m ready',
                ].join('\n'),
            )
        } finally {
            logSpy.mockRestore()
        }
    })
})

function restoreEnv(
    key: 'FORCE_COLOR' | 'NO_COLOR',
    value: string | undefined,
): void {
    if (value === undefined) {
        delete process.env[key]
        return
    }

    process.env[key] = value
}

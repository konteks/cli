import { describe, expect, it } from 'bun:test'
import getVersion from '@/support/get-version'
import { runSourceCli } from '../support/cli'
import { makeTempProject } from '../support/project'

describe('CLI initialization middleware', () => {
    for (const args of [
        ['status'],
        ['config'],
        ['rebuild'],
        ['backup', 'backup.tar.gz'],
        ['memory', 'export', 'memory.json'],
        ['memory', 'import', 'memory.json'],
        ['install-skills'],
        ['mcp'],
        ['mcp', 'tools'],
        // ['mcp', 'tools', 'konteks_warm_up'],
    ]) {
        it(`blocks ${args.join(' ')} when project memory is not initialized`, async () => {
            const projectRoot = await makeTempProject('konteks-cli-')

            const result = await runSourceCli(projectRoot, args)

            expect(result.exitCode).not.toBe(0)
            if (
                !args[0]?.startsWith('mcp') &&
                args[0] !== 'status' &&
                args[0] !== 'rebuild'
            ) {
                expect(result.output).toContain(`Konteks v${getVersion()}`)
            }
            expect(result.output).toContain('Konteks memory is not initialized')
            expect(result.output).toContain('Project memory is missing')
            expect(result.output).toContain('konteks init')
            expect(result.output).not.toContain(
                'at ensureCliProjectInitialized',
            )
        })
    }

    it('renders the initialization error with color when color is forced', async () => {
        const projectRoot = await makeTempProject('konteks-cli-')

        const result = await runSourceCli(projectRoot, ['status'], {
            FORCE_COLOR: '1',
            NO_COLOR: '',
        })

        expect(result.exitCode).not.toBe(0)
        expect(result.output).toContain('Konteks')
        expect(result.output).toContain('\u001b[31m')
        expect(result.output).toContain('╭─')
    })
})

it('allows restore to run before project memory is initialized', async () => {
    const projectRoot = await makeTempProject('konteks-cli-')

    const result = await runSourceCli(projectRoot, [
        'restore',
        'missing.tar.gz',
    ])

    expect(result.exitCode).not.toBe(0)
    expect(result.output).toContain(`Konteks v${getVersion()}`)
    expect(result.output).not.toContain('Konteks memory is not initialized')
})

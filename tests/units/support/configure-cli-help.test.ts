import { describe, expect, it, mock } from 'bun:test'
import { decode } from '@toon-format/toon'
import { Command } from 'commander'
import getVersion from '@/support/get-version'

let detectedAgent = false

mock.module('@vercel/detect-agent', () => ({
    determineAgent: async () => ({ isAgent: detectedAgent }),
}))

describe('configureCliHelp', () => {
    it('preserves the default help sections and content for humans', async () => {
        detectedAgent = false
        const program = await createProgram(false)

        const help = program.helpInformation()

        expect(help).toContain('██████')
        expect(help).toContain(
            'Project-local context memory for AI coding agents.',
        )
        expect(help).toContain(centerText(bannerTagline, bannerWidth))
        expect(help).toContain(`Konteks  v${getVersion()}`)
        expect(help).toContain('konteks [options] [command]')
        expect(help).not.toContain(
            'Konteks 0.0.0 - Project-local context memory for AI coding agents.',
        )
        expect(help).not.toContain('Project-local context memory.\n\nOptions')
        expect(help.indexOf('██████')).toBeLessThan(help.indexOf('konteks'))
        expect(help).toContain('restore [options] <file>')
        expect(help).toContain('<value>  required')
        expect(help).toContain('[value]  optional')
        expect(help.indexOf('-V, --version')).toBeLessThan(
            help.indexOf('<value>  required'),
        )
        expect(help).toContain('USAGE')
        expect(help).not.toContain('Usage')
        expect(help).not.toContain('USAGE:')
        expect(help).not.toContain('Arguments\n')
        expect(help).not.toContain('Commands\n')
        expect(help).not.toContain('Options\n')
        expect(help).not.toContain('Legend\n')
        expect(help).not.toContain('Usage:')
        expect(help).not.toContain('Arguments:')
        expect(help).not.toContain('Options:')
        expect(help).not.toContain('Commands:')
        expect(help).not.toContain('Legend:')
        expect(help).not.toContain('\u001b[')
    })

    it('omits the legend when human help has no argument placeholders', async () => {
        detectedAgent = false
        const program = new Command()
            .name('konteks')
            .description('Project-local context memory.')
            .helpOption(false)
        const { configureCliHelp } = await import(
            '@/support/configure-cli-help'
        )

        await configureCliHelp(program)

        const help = program.helpInformation()

        expect(help).not.toContain('Legend')
    })

    it('prints structured TOON from rendered help for agents', async () => {
        detectedAgent = true
        const program = await createProgram(false)

        const help = program.helpInformation()
        const output = asRecord(decode(help))

        expect(help).not.toContain('██████')
        expect(help).not.toContain('USAGE')
        expect(help).not.toContain('<value>  required')
        expect(help).not.toContain('\u001b[')
        expect(output.usage).toBe('konteks [options] [command]')

        const entries = asRecords(output.entries)
        expect(entries).toContainEqual(
            expect.objectContaining({
                description: 'output the version number',
                term: '-V, --version',
            }),
        )
        expect(entries).toContainEqual(
            expect.objectContaining({
                description: 'Restore a full .konteks backup archive.',
                term: 'restore [options] <file>',
            }),
        )

        const legend = asRecords(output.legend)
        expect(legend).toContainEqual(
            expect.objectContaining({
                meaning: 'required',
                term: '<value>',
            }),
        )
        expect(legend).toContainEqual(
            expect.objectContaining({
                meaning: 'optional',
                term: '[value]',
            }),
        )
    })
})

async function createProgram(hasColors: boolean): Promise<Command> {
    const program = new Command()
        .name('konteks')
        .description('Project-local context memory.')
        .version('0.0.0')
    const { configureCliHelp } = await import('@/support/configure-cli-help')

    await configureCliHelp(program)
    program.configureOutput({
        getOutHasColors: () => hasColors,
    })

    program
        .command('restore')
        .description('Restore a full .konteks backup archive.')
        .argument('<file>', 'Backup archive.')
        .option('-f, --force', 'Overwrite existing memory.')

    return program
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as JsonRecord
    }

    throw new Error('Expected object value.')
}

function asRecords(value: unknown): JsonRecord[] {
    if (Array.isArray(value)) {
        return value.map(asRecord)
    }

    throw new Error('Expected object array.')
}

const bannerTagline = '✦ Project-local context memory for AI coding agents. ✦'
const bannerWidth = 68

function centerText(value: string, width: number): string {
    const totalPadding = width - value.length
    const leftPadding = Math.floor(totalPadding / 2)
    const rightPadding = totalPadding - leftPadding

    return `${' '.repeat(leftPadding)}${value}${' '.repeat(rightPadding)}`
}

import { describe, expect, it } from 'bun:test'
import { Command } from 'commander'
import { configureCliHelp } from '@/support/configure-cli-help'
import getVersion from '@/support/get-version'

describe('configureCliHelp', () => {
    it('preserves the default help sections and content', () => {
        const program = createProgram(false)

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

    it('omits the legend when help has no argument placeholders', () => {
        const program = new Command()
            .name('konteks')
            .description('Project-local context memory.')
            .helpOption(false)

        configureCliHelp(program)

        const help = program.helpInformation()

        expect(help).not.toContain('Legend')
    })
})

function createProgram(hasColors: boolean): Command {
    const program = new Command()
        .name('konteks')
        .description('Project-local context memory.')
        .version('0.0.0')

    configureCliHelp(program)
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

const bannerTagline = '✦ Project-local context memory for AI coding agents. ✦'
const bannerWidth = 68

function centerText(value: string, width: number): string {
    const totalPadding = width - value.length
    const leftPadding = Math.floor(totalPadding / 2)
    const rightPadding = totalPadding - leftPadding

    return `${' '.repeat(leftPadding)}${value}${' '.repeat(rightPadding)}`
}

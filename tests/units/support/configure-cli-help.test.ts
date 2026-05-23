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

    it('highlights help syntax when colors are enabled', () => {
        const program = createProgram(true)

        const help = program.helpInformation()

        expect(help).toContain('\u001b[38;2;1;101;252m')
        expect(help).toContain('\u001b[38;2;157;0;255m')
        expect(bannerBackgroundPattern().test(help)).toBe(true)
        expect(help).toContain('\u001b[33m  USAGE\u001b[0m')
        expect(help).not.toContain('\u001b[33mLegend\u001b[0m')
        expect(help).not.toContain(
            '\u001b[90mProject-local context memory.\u001b[0m',
        )
        expect(help).toContain(`\u001b[90mv${getVersion()}\u001b[0m`)
        expect(help).not.toContain('\u001b[36mkonteks\u001b[0m')
        expect(help).not.toContain('\u001b[32m[command]\u001b[0m')
        expect(help).toMatch(themeColorPattern('konteks'))
        expect(help).toMatch(themeColorPattern('-h,'))
        expect(help).toMatch(themeColorPattern('[command]'))
        expect(help).toMatch(themeColorPattern('<value>'))
        expect(help).toMatch(themeColorPattern('[value]'))
        expect(help).toContain('\u001b[90mrequired\u001b[0m')
        expect(help).toContain('\u001b[90moptional\u001b[0m')
        expect(stripAnsi(help)).toContain(`Konteks  v${getVersion()}`)
        expect(stripAnsi(help)).toContain('konteks [options] [command]')
    })

    it('applies the same highlighting to subcommand help', () => {
        const program = createProgram(true)
        const restore = program.commands.find(
            command => command.name() === 'restore',
        )

        const help = restore?.helpInformation()

        expect(help).toContain('\u001b[33m  USAGE\u001b[0m')
        expect(help).toMatch(themeColorPattern('restore'))
        expect(help).toMatch(themeColorPattern('<file>'))
        expect(help).not.toContain('\u001b[33mLegend\u001b[0m')
        expect(stripAnsi(help ?? '')).toContain(
            'konteks restore [options] <file>',
        )
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

function stripAnsi(value: string): string {
    const ansiPattern = String.raw`\u001B\[[0-9;]*m`

    return value.replace(new RegExp(ansiPattern, 'gu'), '')
}

function bannerBackgroundPattern(): RegExp {
    const ansiEscape = String.raw`\u001B`
    const tagline = String.raw`\s+✦ Project-local context memory for AI coding agents\. ✦\s+`

    return new RegExp(
        `${ansiEscape}\\[48;2;(?:1;101;252|157;0;255)m${tagline}${ansiEscape}\\[0m`,
        'u',
    )
}

function themeColorPattern(value: string): RegExp {
    const ansiEscape = String.raw`\u001B`
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

    return new RegExp(
        `${ansiEscape}\\[38;2;(?:1;101;252|157;0;255)m${escapedValue}${ansiEscape}\\[0m`,
        'u',
    )
}

const bannerTagline = '✦ Project-local context memory for AI coding agents. ✦'
const bannerWidth = 68

function centerText(value: string, width: number): string {
    const totalPadding = width - value.length
    const leftPadding = Math.floor(totalPadding / 2)
    const rightPadding = totalPadding - leftPadding

    return `${' '.repeat(leftPadding)}${value}${' '.repeat(rightPadding)}`
}

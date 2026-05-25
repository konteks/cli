import { encode } from '@toon-format/toon'
import { determineAgent } from '@vercel/detect-agent'
import type { Command, Help } from 'commander'
import {
    type BannerHeaderTheme,
    colorRgb,
    createBannerHeaderTheme,
    formatBannerHeader,
} from '@/support/tui/components'

export async function configureCliHelp(program: Command): Promise<void> {
    const { isAgent } = await determineAgent()

    program.configureHelp({
        formatHelp: (command, helper) => {
            const theme = createBannerHeaderTheme()
            applyHelpTheme(helper, theme)
            const help = formatCommandHelp(command, helper, theme)

            if (isAgent) {
                return formatHelpForAgent(help)
            }

            return `${formatBannerHeader(theme)}\n\n${help}`
        },
    })
}

type AgentHelpEntry = {
    term: string
    description?: string
}

type AgentHelpLegend = {
    term: string
    meaning: string
}

type AgentHelpToon = {
    usage?: string
    entries?: AgentHelpEntry[]
    legend?: AgentHelpLegend[]
}

function formatHelpForAgent(help: string): string {
    const output: AgentHelpToon = {}
    const entries: AgentHelpEntry[] = []
    const legend: AgentHelpLegend[] = []

    for (const line of stripAnsi(help).trimEnd().split('\n')) {
        const trimmed = line.trim()

        if (trimmed.length === 0) {
            continue
        }

        if (trimmed.startsWith('USAGE ')) {
            output.usage = trimmed.slice('USAGE '.length)
            continue
        }

        const item = parseHelpItem(trimmed)
        if (!item) {
            continue
        }

        if (isLegendItem(item)) {
            legend.push({
                meaning: item.description ?? '',
                term: item.term,
            })
            continue
        }

        entries.push(item)
    }

    if (entries.length > 0) {
        output.entries = entries
    }

    if (legend.length > 0) {
        output.legend = legend
    }

    return encode(output)
}

function parseHelpItem(line: string): AgentHelpEntry | undefined {
    const [term, description] = line.split(/\s{2,}/u, 2)

    if (!term) {
        return undefined
    }

    return {
        description: description || undefined,
        term,
    }
}

function isLegendItem(item: AgentHelpEntry): boolean {
    return (
        (item.term === '<value>' || item.term === '[value]') &&
        (item.description === 'required' || item.description === 'optional')
    )
}

function stripAnsi(value: string): string {
    return value.replace(ansiColorPattern, '')
}

const ansiColorPattern = new RegExp(
    `${String.fromCharCode(27)}\\[[0-9;]*m`,
    'gu',
)

type ColorName = 'dim' | 'warning'

const colorCodes: Record<ColorName, number> = {
    dim: 90,
    warning: 33,
}

function applyHelpTheme(helper: Help, theme: BannerHeaderTheme): void {
    helper.styleArgumentTerm = argument => colorRgb(theme.secondary, argument)
    helper.styleArgumentText = argument => colorRgb(theme.secondary, argument)
    helper.styleCommandText = command => colorRgb(theme.primary, command)
    helper.styleDescriptionText = description => color('dim', description)
    helper.styleOptionTerm = term => highlightCliSyntax(term, theme)
    helper.styleOptionText = option => colorRgb(theme.primary, option)
    helper.styleSubcommandTerm = term => highlightCliSyntax(term, theme)
    helper.styleTitle = title => color('warning', title.replace(/:$/u, ''))
    helper.styleUsage = usage => highlightCliSyntax(usage, theme)
}

function formatCommandHelp(
    command: Command,
    helper: Help,
    theme: BannerHeaderTheme,
): string {
    const termWidth = helper.padWidth(command, helper)
    const output = [
        `${color('warning', '  USAGE')} ${helper.styleUsage(helper.commandUsage(command))}`,
        '',
    ]

    output.push(...formatArgumentSection(command, helper, termWidth))
    output.push(...formatCommandSection(command, helper, termWidth))
    output.push(...formatOptionSections(command, helper, termWidth))
    output.push(...formatArgumentLegend(command, helper, theme))

    return `${output.join('\n')}\n`
}

function formatArgumentSection(
    command: Command,
    helper: Help,
    termWidth: number,
): string[] {
    const argumentsList = helper.visibleArguments(command).map(argument => {
        return helper.formatItem(
            helper.styleArgumentTerm(helper.argumentTerm(argument)),
            termWidth,
            helper.styleArgumentDescription(
                helper.argumentDescription(argument),
            ),
            helper,
        )
    })

    return formatItemRows(argumentsList)
}

function formatCommandSection(
    command: Command,
    helper: Help,
    termWidth: number,
): string[] {
    const commandGroups = helper.groupItems(
        [...command.commands],
        helper.visibleCommands(command),
        subcommand => subcommand.helpGroup() || 'Commands:',
    )
    const output: string[] = []

    commandGroups.forEach(commands => {
        const commandList = commands.map(subcommand => {
            return helper.formatItem(
                helper.styleSubcommandTerm(helper.subcommandTerm(subcommand)),
                termWidth,
                helper.styleSubcommandDescription(
                    helper.subcommandDescription(subcommand),
                ),
                helper,
            )
        })

        output.push(...formatItemRows(commandList))
    })

    return output
}

function formatOptionSections(
    command: Command,
    helper: Help,
    termWidth: number,
): string[] {
    const output: string[] = []

    if (helper.showGlobalOptions) {
        const globalOptionList = helper
            .visibleGlobalOptions(command)
            .map(option => {
                return helper.formatItem(
                    helper.styleOptionTerm(helper.optionTerm(option)),
                    termWidth,
                    helper.styleOptionDescription(
                        helper.optionDescription(option),
                    ),
                    helper,
                )
            })

        output.push(...formatItemRows(globalOptionList))
    }

    const optionGroups = helper.groupItems(
        [...command.options],
        helper.visibleOptions(command),
        option => option.helpGroupHeading ?? 'Options:',
    )

    optionGroups.forEach(options => {
        const optionList = options.map(option => {
            return helper.formatItem(
                helper.styleOptionTerm(helper.optionTerm(option)),
                termWidth,
                helper.styleOptionDescription(helper.optionDescription(option)),
                helper,
            )
        })

        output.push(...formatItemRows(optionList))
    })

    return output
}

function formatItemRows(items: string[]): string[] {
    if (items.length === 0) {
        return []
    }

    return [...items, '']
}

function highlightCliSyntax(value: string, theme: BannerHeaderTheme): string {
    return value
        .split(/(\s+)/u)
        .map(part => {
            if (/^\s+$/u.test(part)) {
                return part
            }

            if (part.startsWith('-')) {
                return colorRgb(theme.primary, part)
            }

            if (/^(?:\[[^\]]+\]|<[^>]+>)$/u.test(part)) {
                return colorRgb(theme.secondary, part)
            }

            return colorRgb(theme.primary, part)
        })
        .join('')
}

function color(name: ColorName, value: string): string {
    if (value.length === 0) {
        return value
    }

    return `\u001b[${colorCodes[name]}m${value}\u001b[0m`
}

function formatArgumentLegend(
    command: Command,
    helper: Help,
    theme: BannerHeaderTheme,
): string[] {
    const terms = helper.visibleCommands(command).flatMap(child => {
        return helper.subcommandTerm(child).split(/\s+/u)
    })
    const helpTerms = [helper.commandUsage(command), ...terms]

    const hasRequired = helpTerms.some(term => /<[^>]+>/u.test(term))
    const hasOptional = helpTerms.some(term => /\[[^\]]+\]/u.test(term))

    if (!hasRequired && !hasOptional) {
        return []
    }

    const lines: string[] = []

    if (hasRequired) {
        lines.push(
            `  ${colorRgb(theme.secondary, '<value>')}  ${color('dim', 'required')}`,
        )
    }

    if (hasOptional) {
        lines.push(
            `  ${colorRgb(theme.secondary, '[value]')}  ${color('dim', 'optional')}`,
        )
    }

    lines.push('')

    return lines
}

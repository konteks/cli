import getVersion from '@/support/get-version'

export type RgbColor = {
    blue: number
    green: number
    red: number
}

export type BannerHeaderTheme = {
    primary: RgbColor
    secondary: RgbColor
}

const bannerLines = [
    '  ██╗  ██╗  ██████╗  ███╗   ██╗ ████████╗ ███████╗ ██╗  ██╗ ███████╗  ',
    '  ██║ ██╔╝ ██╔═══██╗ ████╗  ██║ ╚══██╔══╝ ██╔════╝ ██║ ██╔╝ ██╔════╝  ',
    '  █████╔╝  ██║   ██║ ██╔██╗ ██║    ██║    █████╗   █████╔╝  ███████╗  ',
    '  ██╔═██╗  ██║   ██║ ██║╚██╗██║    ██║    ██╔══╝   ██╔═██╗  ╚════██║  ',
    '  ██║  ██╗ ╚██████╔╝ ██║ ╚████║    ██║    ███████╗ ██║  ██╗ ███████║  ',
    '  ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═══╝    ╚═╝    ╚══════╝ ╚═╝  ╚═╝ ╚══════╝  ',
]

const bannerGradientColors = [hexToRgb('0165fc'), hexToRgb('9d00ff')] as const
const bannerTagline = '✦ Project-local context memory for AI coding agents. ✦'
const bannerWidth = Math.max(...bannerLines.map(line => line.length))

export function createBannerHeaderTheme(): BannerHeaderTheme {
    const [primary, secondary] =
        Math.random() < 0.5
            ? bannerGradientColors
            : [bannerGradientColors[1], bannerGradientColors[0]]

    return { primary, secondary }
}

export function formatBannerHeader(theme: BannerHeaderTheme): string {
    return [
        colorBanner(theme.primary, theme.secondary),
        '',
        colorBackground(theme.primary, centerText(bannerTagline, bannerWidth)),
        '',
        `  ${colorRgb(theme.primary, 'Konteks')}  ${dim(`v${getVersion()}`)}`,
    ].join('\n')
}

export function colorRgb(rgb: RgbColor, value: string): string {
    if (value.length === 0) {
        return value
    }

    return `\u001b[38;2;${rgb.red};${rgb.green};${rgb.blue}m${value}\u001b[0m`
}

function colorBanner(top: RgbColor, bottom: RgbColor): string {
    return bannerLines
        .map((line, index) => {
            const ratio = index / (bannerLines.length - 1)

            return colorRgb(interpolateRgb(top, bottom, ratio), line)
        })
        .join('\n')
}

function colorBackground(rgb: RgbColor, value: string): string {
    if (value.length === 0) {
        return value
    }

    return `\u001b[48;2;${rgb.red};${rgb.green};${rgb.blue}m${value}\u001b[0m`
}

function dim(value: string): string {
    if (value.length === 0) {
        return value
    }

    return `\u001b[90m${value}\u001b[0m`
}

function hexToRgb(hex: string): RgbColor {
    return {
        blue: Number.parseInt(hex.slice(4, 6), 16),
        green: Number.parseInt(hex.slice(2, 4), 16),
        red: Number.parseInt(hex.slice(0, 2), 16),
    }
}

function interpolateRgb(
    start: RgbColor,
    end: RgbColor,
    ratio: number,
): RgbColor {
    return {
        blue: interpolateNumber(start.blue, end.blue, ratio),
        green: interpolateNumber(start.green, end.green, ratio),
        red: interpolateNumber(start.red, end.red, ratio),
    }
}

function interpolateNumber(start: number, end: number, ratio: number): number {
    return Math.round(start + (end - start) * ratio)
}

function centerText(value: string, width: number): string {
    if (value.length >= width) {
        return value
    }

    const totalPadding = width - value.length
    const leftPadding = Math.floor(totalPadding / 2)
    const rightPadding = totalPadding - leftPadding

    return `${' '.repeat(leftPadding)}${value}${' '.repeat(rightPadding)}`
}

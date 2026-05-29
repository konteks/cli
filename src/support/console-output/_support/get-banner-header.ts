import type { ConsoleColorPalette } from '@/support/console-output'
import getVersion from '@/support/get-version'
import { primaryColorHex, secondaryColorHex } from './color-palette'
import hexToRgb from './hex-to-rgb'
import isSupportsColor from './is-supports-color'

const bannerLines = [
    '  ██╗  ██╗  ██████╗  ███╗   ██╗ ████████╗ ███████╗ ██╗  ██╗ ███████╗  ',
    '  ██║ ██╔╝ ██╔═══██╗ ████╗  ██║ ╚══██╔══╝ ██╔════╝ ██║ ██╔╝ ██╔════╝  ',
    '  █████╔╝  ██║   ██║ ██╔██╗ ██║    ██║    █████╗   █████╔╝  ███████╗  ',
    '  ██╔═██╗  ██║   ██║ ██║╚██╗██║    ██║    ██╔══╝   ██╔═██╗  ╚════██║  ',
    '  ██║  ██╗ ╚██████╔╝ ██║ ╚████║    ██║    ███████╗ ██║  ██╗ ███████║  ',
    '  ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═══╝    ╚═╝    ╚══════╝ ╚═╝  ╚═╝ ╚══════╝  ',
]

const bannerTagline = '✦ Project-local context memory for AI coding agents. ✦'
const bannerWidth = Math.max(...bannerLines.map(line => line.length))
const primaryColor = hexToRgb(primaryColorHex)
const secondaryColor = hexToRgb(secondaryColorHex)

type RgbColor = ReturnType<typeof hexToRgb>

export default function getBannerHeader(color: ConsoleColorPalette): string {
    return [
        colorBanner(),
        '',
        primaryBackground(centerText(bannerTagline, bannerWidth)),
        '',
        `  ${color.primary('Konteks')}  ${color.dim(`v${getVersion()}`)}`,
    ].join('\n')
}

function colorBanner(): string {
    return bannerLines
        .map((line, index) => {
            const ratio = index / (bannerLines.length - 1)

            return foreground(
                interpolateRgb(primaryColor, secondaryColor, ratio),
                line,
            )
        })
        .join('\n')
}

function foreground(color: RgbColor, value: string): string {
    if (value.length === 0 || !isSupportsColor()) {
        return value
    }

    return `\u001b[38;2;${color.red};${color.green};${color.blue}m${value}\u001b[0m`
}

function primaryBackground(value: string): string {
    if (value.length === 0 || !isSupportsColor()) {
        return value
    }

    return `\u001b[48;2;${primaryColor.red};${primaryColor.green};${primaryColor.blue}m${value}\u001b[0m`
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

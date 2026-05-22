import type { ColorPalette } from '@/support/terminal/create-color-palette'

export type TuiText = {
    checkLine(message: string): string
    count(value: number): string
    progressLine(spinnerIndex: number, message: string): string
    sectionTitle(message: string): string
    statLine(label: string, value: number): string
}

export function createTuiText(color: ColorPalette): TuiText {
    return {
        checkLine(message) {
            return `${color.success('✓')} ${message}`
        },
        count(value) {
            return color.info(value.toString())
        },
        progressLine(spinnerIndex, message) {
            return `${color.accent(spinnerFrame(spinnerIndex))} ${message}`
        },
        sectionTitle(message) {
            return color.accent(message)
        },
        statLine(label, value) {
            return `${color.dim(label.padEnd(20))} ${color.info(value.toString())}`
        },
    }
}

export function spinnerFrame(index: number): string {
    return ['◐', '◓', '◑', '◒'][index % 4] ?? '◐'
}

export function visibleLength(value: string): number {
    const ansiPattern = new RegExp(
        `${String.fromCharCode(27)}\\[[0-9;]*m`,
        'gu',
    )
    return value.replaceAll(ansiPattern, '').length
}

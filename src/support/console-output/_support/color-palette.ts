import hexToRgb from './hex-to-rgb'
import isSupportsColor from './is-supports-color'

function wrap(hex: string, value: string): string {
    if (value.length === 0 || !isSupportsColor()) {
        return value
    }

    const color = hexToRgb(hex)

    return `\u001b[38;2;${color.red};${color.green};${color.blue}m${value}\u001b[0m`
}

export const primaryColorHex = '#0165fc'
export const secondaryColorHex = '#9d00ff'

const colorPalette = {
    dim: (value: string) => wrap('#6b7280', value),
    error: (value: string) => wrap('#ef4444', value),
    info: (value: string) => wrap('#3b82f6', value),
    primary: (value: string) => wrap(primaryColorHex, value),
    secondary: (value: string) => wrap(secondaryColorHex, value),
    success: (value: string) => wrap('#22c55e', value),
    warning: (value: string) => wrap('#fffb00', value),
} as const

export default colorPalette

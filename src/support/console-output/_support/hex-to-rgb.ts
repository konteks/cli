export default function hexToRgb(hex: string): {
    blue: number
    green: number
    red: number
} {
    const value = hex.replace(/^#/u, '')

    return {
        blue: Number.parseInt(value.slice(4, 6), 16),
        green: Number.parseInt(value.slice(2, 4), 16),
        red: Number.parseInt(value.slice(0, 2), 16),
    }
}

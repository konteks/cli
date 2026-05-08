export type ColorPalette = {
    accent(value: string): string
    dim(value: string): string
    info(value: string): string
    success(value: string): string
}

export function createColorPalette(enabled: boolean): ColorPalette {
    function wrap(code: number, value: string): string {
        return enabled ? `\u001b[${code}m${value}\u001b[0m` : value
    }

    return {
        accent: value => wrap(36, value),
        dim: value => wrap(90, value),
        info: value => wrap(34, value),
        success: value => wrap(32, value),
    }
}

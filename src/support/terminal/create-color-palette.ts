export type ColorPalette = {
    accent(value: string): string
    danger(value: string): string
    dim(value: string): string
    info(value: string): string
    success(value: string): string
    warning(value: string): string
}

export default function createColorPalette(enabled: boolean): ColorPalette {
    function wrap(code: number, value: string): string {
        return enabled ? `\u001b[${code}m${value}\u001b[0m` : value
    }

    return {
        accent: value => wrap(36, value),
        danger: value => wrap(31, value),
        dim: value => wrap(90, value),
        info: value => wrap(34, value),
        success: value => wrap(32, value),
        warning: value => wrap(33, value),
    }
}

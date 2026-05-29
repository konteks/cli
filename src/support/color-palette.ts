function supportsColor(): boolean {
    const { env, stderr, stdout } = process

    if (env.NO_COLOR) {
        return false
    }

    if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') {
        return true
    }

    return Boolean(stdout.isTTY && stderr.isTTY)
}

function wrap(code: number, value: string): string {
    return supportsColor() ? `\u001b[${code}m${value}\u001b[0m` : value
}

const colorPalette = {
    accent: (value: string) => wrap(36, value),
    danger: (value: string) => wrap(31, value),
    dim: (value: string) => wrap(90, value),
    info: (value: string) => wrap(34, value),
    success: (value: string) => wrap(32, value),
    warning: (value: string) => wrap(33, value),
} as const

export default colorPalette

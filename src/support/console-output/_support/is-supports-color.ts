export default function isSupportsColor(): boolean {
    const { env, stderr, stdout } = process

    if (env.NO_COLOR) {
        return false
    }

    if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') {
        return true
    }

    return Boolean(stdout.isTTY && stderr.isTTY)
}

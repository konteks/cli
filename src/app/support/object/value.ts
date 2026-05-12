export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function replaceStringDeep(
    value: unknown,
    from: string,
    to: string,
): unknown {
    if (typeof value === 'string') {
        return value.split(from).join(to)
    }

    if (Array.isArray(value)) {
        return value.map(item => replaceStringDeep(item, from, to))
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                replaceStringDeep(item, from, to),
            ]),
        )
    }

    return value
}

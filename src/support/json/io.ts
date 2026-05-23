export function stringifyPretty(value: unknown): string {
    return JSON.stringify(value, null, 2)
}

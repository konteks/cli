export function stringifyPretty(value: unknown): string {
    return JSON.stringify(value, null, 2)
}

export function parseJsonInput(jsonInput?: string): unknown {
    if (!jsonInput) {
        return {}
    }

    try {
        return JSON.parse(jsonInput) as unknown
    } catch (error) {
        throw new Error(
            `Invalid JSON input: ${
                error instanceof Error ? error.message : String(error)
            }`,
        )
    }
}

export function printJson(value: unknown): void {
    console.log(JSON.stringify(value, null, 2))
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

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

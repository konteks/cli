export function textResult(value: unknown, text?: string) {
    const structuredContent =
        typeof value === 'object' && value !== null && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : undefined

    return {
        content: [
            {
                text:
                    text ??
                    (typeof value === 'string'
                        ? value
                        : JSON.stringify(value, null, 2)),
                type: 'text' as const,
            },
        ],
        structuredContent,
    }
}
